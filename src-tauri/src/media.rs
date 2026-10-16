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
/// Video backgrounds are accepted up to this size. Anything larger than
/// 1080p is scaled down on the way in, so a 4K file doesn't have to be
/// decoded on the projector.
pub const MAX_VIDEO_BYTES: usize = 1024 * 1024 * 1024;
/// Playback size. A lyrics background has no use for more than this, and
/// 4K is what makes the screen lag.
const PLAYBACK_W: u32 = 1920;
const PLAYBACK_H: u32 = 1080;

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

/// A video's URL includes its size, so replacing the file (a 4K upload
/// scaled down to 1080p) doesn't keep playing the cached original.
pub fn video_url(hash: &str, ext: &str, size: i64) -> String {
    format!("/media/{hash}.{ext}?v={size}")
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
    /// Returns the size actually stored. MP4 and MOV larger than 1080p are
    /// scaled down first (no 4K decode on the projector); the index is then
    /// moved to the front of the file so playback can loop without a stall.
    /// If ffmpeg isn't available, the upload is kept as sent.
    pub fn store_video(&self, tmp: &Path, hash: &str, ext: &str) -> std::io::Result<u64> {
        let path = self.dir.join(format!("{hash}.{ext}"));
        if path.exists() {
            std::fs::remove_file(tmp)?;
            if !self.poster_path(hash).exists() {
                self.write_poster(&path, hash);
            }
            return Ok(std::fs::metadata(&path)?.len());
        }
        if ext == "mp4" || ext == "mov" {
            prepare_playback(tmp);
        }
        std::fs::rename(tmp, &path)?;
        self.write_poster(&path, hash);
        Ok(std::fs::metadata(&path)?.len())
    }

    /// Where a video's still frame for the console is kept.
    fn poster_path(&self, hash: &str) -> PathBuf {
        self.dir.join("thumbs").join(format!("{hash}.jpg"))
    }

    /// Save a still frame of a stored video as its thumbnail, so the console
    /// doesn't have to decode the video in the webview to show it (which
    /// draws black for some files). Without ffmpeg there is no still, and
    /// the console grabs a frame itself.
    fn write_poster(&self, video: &Path, hash: &str) {
        let out = self.poster_path(hash);
        let scale = format!("scale={THUMB_W}:{THUMB_H}:force_original_aspect_ratio=decrease");
        // Half a second in skips a fade from black; a shorter clip uses
        // its first frame.
        for seek in ["0.5", "0"] {
            let status = std::process::Command::new("ffmpeg")
                .args([
                    "-y",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-ss",
                    seek,
                    "-i",
                ])
                .arg(video)
                .args(["-frames:v", "1", "-vf", &scale, "-q:v", "4", "-f", "image2"])
                .arg(&out)
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status();
            if matches!(&status, Ok(s) if s.success())
                && std::fs::metadata(&out).is_ok_and(|m| m.len() > 0)
            {
                return;
            }
        }
        let _ = std::fs::remove_file(&out);
    }

    /// Scale 4K videos already in the library down to 1080p, move a late
    /// index to the front of any other MP4 or MOV, and give every video a
    /// still frame. Returns `(hash,
    /// new size)` for files whose bytes changed, so the URL can change
    /// with them and the player doesn't keep a cached 4K copy.
    pub fn repack_videos(&self) -> Vec<(String, u64)> {
        let Ok(entries) = std::fs::read_dir(&self.dir) else {
            return Vec::new();
        };
        let mut scaled = Vec::new();
        for entry in entries.flatten() {
            let path = entry.path();
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            let Some(hash) = path.file_stem().and_then(|s| s.to_str()) else {
                continue;
            };
            if !path.is_file() || !is_video_ext(ext) || hash.len() != 64 {
                continue;
            }
            let before = std::fs::metadata(&path).ok().map(|m| m.len());
            if ext == "mp4" || ext == "mov" {
                prepare_playback(&path);
            }
            let Ok(meta) = std::fs::metadata(&path) else {
                continue;
            };
            let changed = before != Some(meta.len());
            // Videos from before stills existed get one now.
            if changed || !self.poster_path(hash).exists() {
                self.write_poster(&path, hash);
            }
            if changed {
                scaled.push((hash.to_string(), meta.len()));
            }
        }
        scaled
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

fn fits_playback(width: u32, height: u32) -> bool {
    width > 0 && height > 0 && width <= PLAYBACK_W && height <= PLAYBACK_H
}

/// Width and height of the first video stream, if ffprobe can read them.
fn probe_size(path: &Path) -> Option<(u32, u32)> {
    let output = std::process::Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "csv=p=0",
        ])
        .arg(path)
        .stdin(std::process::Stdio::null())
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8(output.stdout).ok()?;
    let mut nums = text
        .lines()
        .next()?
        .split(',')
        .filter_map(|part| part.trim().parse::<u32>().ok());
    let width = nums.next()?;
    let height = nums.next()?;
    if width == 0 || height == 0 {
        return None;
    }
    Some((width, height))
}

fn h264_encoder() -> Option<&'static str> {
    use std::sync::OnceLock;
    static CHOICE: OnceLock<Option<&'static str>> = OnceLock::new();
    *CHOICE.get_or_init(|| {
        let output = std::process::Command::new("ffmpeg")
            .args(["-hide_banner", "-encoders"])
            .stdin(std::process::Stdio::null())
            .output()
            .ok()?;
        let text = String::from_utf8(output.stdout).ok()?;
        if text.lines().any(|line| line.contains(" libx264 ")) {
            Some("libx264")
        } else if text.lines().any(|line| line.contains(" libopenh264 ")) {
            Some("libopenh264")
        } else {
            None
        }
    })
}

/// Scale `path` in place so it fits in 1080p as H.264. A failure leaves
/// the original bytes alone.
fn downscale(path: &Path, width: u32, height: u32) -> bool {
    let Some(encoder) = h264_encoder() else {
        eprintln!("cellpresenter: ffmpeg has no H.264 encoder; leaving {width}x{height} video as uploaded");
        return false;
    };
    eprintln!("cellpresenter: scaling a {width}x{height} video down to 1080p so it plays smoothly");
    let out = path.with_extension("playback");
    let mut cmd = std::process::Command::new("ffmpeg");
    cmd.args(["-y", "-hide_banner", "-loglevel", "error", "-i"])
        .arg(path)
        .args([
            "-an",
            "-vf",
            "scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2",
            "-pix_fmt",
            "yuv420p",
            "-c:v",
            encoder,
        ]);
    if encoder == "libx264" {
        cmd.args(["-preset", "veryfast", "-crf", "20"]);
    } else {
        cmd.args(["-b:v", "8M"]);
    }
    let result = cmd
        .args(["-movflags", "+faststart", "-f", "mp4"])
        .arg(&out)
        .stdin(std::process::Stdio::null())
        .output();
    let ok = match result {
        Ok(output) if output.status.success() => {
            probe_size(&out).is_some_and(|(w, h)| fits_playback(w, h))
        }
        Ok(output) => {
            let err = String::from_utf8_lossy(&output.stderr);
            eprintln!("cellpresenter: couldn't scale video: {}", err.trim());
            false
        }
        Err(e) => {
            eprintln!("cellpresenter: ffmpeg isn't available ({e})");
            false
        }
    };
    if ok && std::fs::rename(&out, path).is_ok() {
        return true;
    }
    let _ = std::fs::remove_file(&out);
    false
}

/// Make `path` something the display can play smoothly: 1080p at most, with
/// the index at the front of the file.
fn prepare_playback(path: &Path) {
    if let Some((width, height)) = probe_size(path) {
        if !fits_playback(width, height) && downscale(path, width, height) {
            return;
        }
    }
    faststart(path);
}

/// True when the player can start without reading the whole file, or when
/// the file isn't a box structure we should try to rewrite.
fn moov_is_before_mdat(path: &Path) -> bool {
    use std::io::{Read, Seek, SeekFrom};
    let Ok(mut file) = std::fs::File::open(path) else {
        return true;
    };
    let Ok(len) = file.metadata().map(|m| m.len()) else {
        return true;
    };
    let mut pos = 0u64;
    let mut hdr = [0u8; 8];
    while pos + 8 <= len {
        if file.seek(SeekFrom::Start(pos)).is_err() || file.read_exact(&mut hdr).is_err() {
            return true;
        }
        let size32 = u32::from_be_bytes([hdr[0], hdr[1], hdr[2], hdr[3]]);
        let kind = [hdr[4], hdr[5], hdr[6], hdr[7]];
        let box_size = if size32 == 1 {
            if file.read_exact(&mut hdr).is_err() {
                return true;
            }
            u64::from_be_bytes(hdr)
        } else if size32 == 0 {
            len - pos
        } else {
            u64::from(size32)
        };
        let Some(end) = pos.checked_add(box_size) else {
            return true;
        };
        if box_size < 8 || end > len {
            return true;
        }
        if &kind == b"moov" {
            return true;
        }
        if &kind == b"mdat" {
            return false;
        }
        pos = end;
    }
    true
}

/// Remux `path` in place so the `moov` index is at the front. A failure
/// leaves the original bytes alone.
fn faststart(path: &Path) {
    if moov_is_before_mdat(path) {
        return;
    }
    let out = path.with_extension("faststart");
    let status = std::process::Command::new("ffmpeg")
        .args(["-y", "-hide_banner", "-loglevel", "error", "-i"])
        .arg(path)
        .args(["-c", "copy", "-movflags", "+faststart"])
        .arg(&out)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();
    let ok = matches!(&status, Ok(s) if s.success())
        && std::fs::metadata(&out).is_ok_and(|m| m.len() > 0);
    if ok {
        if std::fs::rename(&out, path).is_err() {
            let _ = std::fs::remove_file(&out);
        }
    } else {
        let _ = std::fs::remove_file(&out);
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

    #[test]
    fn only_a_frame_bigger_than_the_screen_is_scaled_down() {
        assert!(fits_playback(1920, 1080));
        assert!(fits_playback(1280, 720));
        assert!(!fits_playback(3840, 2160));
        assert!(!fits_playback(2160, 3840));
        assert!(!fits_playback(0, 1080));
    }

    #[test]
    fn a_video_needs_a_remux_only_when_its_index_is_last() {
        fn boxed(kind: &[u8; 4], payload: &[u8]) -> Vec<u8> {
            let mut bytes = ((8 + payload.len()) as u32).to_be_bytes().to_vec();
            bytes.extend_from_slice(kind);
            bytes.extend_from_slice(payload);
            bytes
        }
        let dir = std::env::temp_dir().join(format!("cp-moov-{}", uuid::Uuid::new_v4().simple()));
        std::fs::create_dir_all(&dir).unwrap();
        let late = dir.join("late.mp4");
        let mut bytes = boxed(b"ftyp", b"isom");
        bytes.extend(boxed(b"mdat", &[0u8; 32]));
        bytes.extend(boxed(b"moov", b"xxxx"));
        std::fs::write(&late, &bytes).unwrap();
        assert!(!moov_is_before_mdat(&late));
        let early = dir.join("early.mp4");
        let mut bytes = boxed(b"ftyp", b"isom");
        bytes.extend(boxed(b"moov", b"xxxx"));
        bytes.extend(boxed(b"mdat", &[0u8; 32]));
        std::fs::write(&early, &bytes).unwrap();
        assert!(moov_is_before_mdat(&early));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_stored_video_gets_a_still() {
        let dir = std::env::temp_dir().join(format!("cp-poster-{}", uuid::Uuid::new_v4().simple()));
        let store = MediaStore::new(dir.clone()).unwrap();
        let tmp = store.upload_path();
        // A 0.3 s clip: shorter than the usual half-second seek.
        let made = std::process::Command::new("ffmpeg")
            .args([
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-f",
                "lavfi",
                "-i",
            ])
            .args([
                "testsrc=size=640x360:rate=10:duration=0.3",
                "-pix_fmt",
                "yuv420p",
                "-f",
                "mp4",
            ])
            .arg(&tmp)
            .status();
        if !matches!(made, Ok(s) if s.success()) {
            eprintln!("skipping: ffmpeg can't make a test video here");
            return;
        }
        let hash = "a".repeat(64);
        store.store_video(&tmp, &hash, "mp4").unwrap();
        let still = image::open(store.path(&format!("{hash}.jpg"), true).unwrap()).unwrap();
        assert!(still.width() <= THUMB_W && still.height() <= THUMB_H);
        let _ = std::fs::remove_dir_all(&dir);
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
