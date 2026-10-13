//! Background images: checking uploads, scaling them for screens, making
//! thumbnails, and storing files by content hash (so a picture uploaded
//! twice is stored once, and syncing later only moves hashes nobody has).

use std::io::Cursor;
use std::path::{Path, PathBuf};

use image::codecs::jpeg::JpegEncoder;
use image::{DynamicImage, GenericImageView, ImageFormat};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use ts_rs::TS;

/// Largest side kept for screen images. Bigger photos (phones shoot 4000+ px)
/// are scaled down: they look the same on a projector and load far faster
/// on phones over Wi-Fi.
pub const MAX_SIDE: u32 = 2560;
/// Thumbnails for the console's media grid and pickers.
const THUMB_W: u32 = 480;
const THUMB_H: u32 = 270;
/// Uploads larger than this are refused.
pub const MAX_UPLOAD_BYTES: usize = 40 * 1024 * 1024;
/// Video backgrounds are stored as uploaded, up to this size.
pub const MAX_VIDEO_BYTES: usize = 1024 * 1024 * 1024;

/// A stored background image, as clients see it.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Media {
    pub id: String,
    pub name: String,
    pub hash: String,
    pub width: u32,
    pub height: u32,
    /// Where displays load the full image.
    pub url: String,
    /// Where the console loads the small preview (a video's own file: the
    /// console shows a still frame of it).
    pub thumb_url: String,
    /// A looping video rather than a picture.
    pub video: bool,
    #[ts(type = "number")]
    pub created_at: i64,
}

pub fn image_url(hash: &str, ext: &str) -> String {
    format!("/media/{hash}.{ext}")
}

pub fn thumb_url(hash: &str) -> String {
    format!("/media/thumbs/{hash}.jpg")
}

/// File types kept as video backgrounds.
pub fn is_video_ext(ext: &str) -> bool {
    matches!(ext, "mp4" | "webm" | "mov")
}

/// What kind of video a file is, from its first bytes: MP4 and QuickTime
/// have an `ftyp` box at byte 4, WebM starts with the EBML magic number.
pub fn video_ext(head: &[u8]) -> Option<&'static str> {
    if head.len() >= 12 && &head[4..8] == b"ftyp" {
        return Some(if &head[8..12] == b"qt  " {
            "mov"
        } else {
            "mp4"
        });
    }
    if head.starts_with(&[0x1A, 0x45, 0xDF, 0xA3]) {
        return Some("webm");
    }
    None
}

#[derive(Debug, PartialEq)]
pub enum MediaError {
    NotAnImage,
    TooLarge,
}

/// An upload, ready to store.
pub struct Processed {
    pub hash: String,
    pub ext: &'static str,
    pub width: u32,
    pub height: u32,
    pub image: Vec<u8>,
    pub thumb: Vec<u8>,
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn jpeg(img: &DynamicImage, quality: u8) -> Vec<u8> {
    let mut out = Vec::new();
    let rgb = img.to_rgb8();
    JpegEncoder::new_with_quality(&mut out, quality)
        .encode_image(&rgb)
        .expect("encode jpeg into memory");
    out
}

fn png(img: &DynamicImage) -> Vec<u8> {
    let mut out = Cursor::new(Vec::new());
    img.write_to(&mut out, ImageFormat::Png)
        .expect("encode png into memory");
    out.into_inner()
}

/// Check, scale and encode an upload. Photos become JPEG; images with
/// transparency stay PNG. The hash is of the original bytes.
pub fn process(upload: &[u8]) -> Result<Processed, MediaError> {
    if upload.len() > MAX_UPLOAD_BYTES {
        return Err(MediaError::TooLarge);
    }
    let decoded = image::load_from_memory(upload).map_err(|_| MediaError::NotAnImage)?;
    let (w, h) = decoded.dimensions();
    let img = if w.max(h) > MAX_SIDE {
        decoded.resize(MAX_SIDE, MAX_SIDE, image::imageops::FilterType::Lanczos3)
    } else {
        decoded
    };
    let (width, height) = img.dimensions();
    let has_alpha = img.color().has_alpha();
    let (bytes, ext) = if has_alpha {
        (png(&img), "png")
    } else {
        (jpeg(&img, 86), "jpg")
    };
    let thumb = jpeg(&img.thumbnail(THUMB_W, THUMB_H), 80);
    Ok(Processed {
        hash: hex(&Sha256::digest(upload)),
        ext,
        width,
        height,
        image: bytes,
        thumb,
    })
}

/// Files on disk under the app's media folder.
#[derive(Clone)]
pub struct MediaStore {
    dir: PathBuf,
}

/// A stored file name: a 64-char hex hash plus a known extension. Anything
/// else (paths, `..`) is refused before touching the disk.
pub fn is_media_file_name(name: &str) -> bool {
    let Some((hash, ext)) = name.split_once('.') else {
        return false;
    };
    hash.len() == 64
        && hash
            .chars()
            .all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase())
        && (matches!(ext, "jpg" | "png") || is_video_ext(ext))
}

impl MediaStore {
    pub fn new(dir: PathBuf) -> std::io::Result<Self> {
        std::fs::create_dir_all(dir.join("thumbs"))?;
        Ok(Self { dir })
    }

    /// The folder holding the images (and `thumbs/`).
    pub fn dir(&self) -> &Path {
        &self.dir
    }

    fn write_once(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
        if path.exists() {
            return Ok(());
        }
        let tmp = path.with_extension("tmp");
        std::fs::write(&tmp, bytes)?;
        std::fs::rename(tmp, path)
    }

    pub fn save(&self, p: &Processed) -> std::io::Result<()> {
        Self::write_once(&self.dir.join(format!("{}.{}", p.hash, p.ext)), &p.image)?;
        Self::write_once(
            &self.dir.join("thumbs").join(format!("{}.jpg", p.hash)),
            &p.thumb,
        )
    }

    /// Keep an uploaded video (already written to `tmp`) under its hash.
    pub fn store_video(&self, tmp: &Path, hash: &str, ext: &str) -> std::io::Result<()> {
        let path = self.dir.join(format!("{hash}.{ext}"));
        if path.exists() {
            return std::fs::remove_file(tmp);
        }
        std::fs::rename(tmp, path)
    }

    /// Where an upload is written while it arrives.
    pub fn upload_path(&self) -> PathBuf {
        self.dir
            .join(format!(".upload-{}", uuid::Uuid::new_v4().simple()))
    }

    /// Path of a stored image (`thumb` for its thumbnail), if the name is valid.
    pub fn path(&self, name: &str, thumb: bool) -> Option<PathBuf> {
        if !is_media_file_name(name) {
            return None;
        }
        Some(if thumb {
            self.dir.join("thumbs").join(name)
        } else {
            self.dir.join(name)
        })
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use image::{Rgb, RgbImage, Rgba, RgbaImage};

    #[test]
    fn videos_are_told_by_their_first_bytes() {
        assert_eq!(video_ext(b"\0\0\0\x18ftypisom\0\0"), Some("mp4"));
        assert_eq!(video_ext(b"\0\0\0\x14ftypqt  \0\0"), Some("mov"));
        assert_eq!(
            video_ext(&[0x1A, 0x45, 0xDF, 0xA3, 1, 0, 0, 0]),
            Some("webm")
        );
        assert_eq!(video_ext(b"\x89PNG\r\n\x1a\n...."), None);
        assert!(is_media_file_name(&format!("{}.webm", "a".repeat(64))));
        assert!(!is_media_file_name(&format!("{}.exe", "a".repeat(64))));
    }

    pub fn sample_png(w: u32, h: u32, alpha: bool) -> Vec<u8> {
        let img = if alpha {
            DynamicImage::ImageRgba8(RgbaImage::from_pixel(w, h, Rgba([10, 20, 30, 128])))
        } else {
            DynamicImage::ImageRgb8(RgbImage::from_pixel(w, h, Rgb([200, 100, 50])))
        };
        png(&img)
    }

    #[test]
    fn photos_become_jpeg_and_big_ones_are_scaled_down() {
        let p = process(&sample_png(4000, 3000, false)).unwrap();
        assert_eq!(p.ext, "jpg");
        assert_eq!((p.width, p.height), (2560, 1920));
        assert_eq!(p.hash.len(), 64);
        let thumb = image::load_from_memory(&p.thumb).unwrap();
        assert!(thumb.width() <= THUMB_W && thumb.height() <= THUMB_H);
    }

    #[test]
    fn transparent_images_stay_png_and_small_ones_keep_their_size() {
        let p = process(&sample_png(800, 600, true)).unwrap();
        assert_eq!(p.ext, "png");
        assert_eq!((p.width, p.height), (800, 600));
    }

    #[test]
    fn junk_is_refused() {
        assert_eq!(process(b"not an image").err(), Some(MediaError::NotAnImage));
    }

    #[test]
    fn the_same_upload_hashes_the_same() {
        let bytes = sample_png(64, 64, false);
        assert_eq!(process(&bytes).unwrap().hash, process(&bytes).unwrap().hash);
    }

    #[test]
    fn only_hash_file_names_are_served() {
        let good = format!("{}.jpg", "a".repeat(64));
        assert!(is_media_file_name(&good));
        assert!(!is_media_file_name("../secret.jpg"));
        assert!(!is_media_file_name(&format!("{}.exe", "a".repeat(64))));
        assert!(!is_media_file_name(&format!("{}.jpg", "A".repeat(64))));
        assert!(!is_media_file_name("short.jpg"));
    }
}
