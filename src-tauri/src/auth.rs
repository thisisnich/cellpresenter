//! Who may control the presentation. The laptop running the app is trusted;
//! anything else on the network needs the PIN shown in the console.

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use uuid::Uuid;

/// Wrong PINs allowed from one address before it is locked out for a while.
const MAX_FAILURES: u32 = 5;
const LOCKOUT: Duration = Duration::from_secs(60);

#[derive(Debug, PartialEq, Eq)]
pub enum Denied {
    /// No PIN, or the wrong one.
    PinRequired,
    /// Too many wrong PINs from this address recently.
    TooManyAttempts,
}

struct Failures {
    count: u32,
    since: Instant,
}

pub struct PinGuard {
    pin: String,
    failures: Mutex<HashMap<IpAddr, Failures>>,
}

impl PinGuard {
    pub fn new(pin: String) -> Self {
        Self {
            pin,
            failures: Mutex::new(HashMap::new()),
        }
    }

    /// A fresh 4-digit PIN, new each time the app starts.
    pub fn random() -> Self {
        let n = Uuid::new_v4().as_u128() % 10_000;
        Self::new(format!("{n:04}"))
    }

    pub fn pin(&self) -> &str {
        &self.pin
    }

    pub fn is_local(peer: IpAddr) -> bool {
        peer.to_canonical().is_loopback()
    }

    /// Allow the request if it comes from this machine or carries the PIN.
    pub fn check(&self, peer: IpAddr, supplied: Option<&str>) -> Result<(), Denied> {
        if Self::is_local(peer) {
            return Ok(());
        }
        let mut failures = self.failures.lock().unwrap();
        if let Some(f) = failures.get(&peer) {
            if f.count >= MAX_FAILURES && f.since.elapsed() < LOCKOUT {
                return Err(Denied::TooManyAttempts);
            }
        }
        let Some(supplied) = supplied else {
            return Err(Denied::PinRequired);
        };
        if supplied.trim() == self.pin {
            failures.remove(&peer);
            return Ok(());
        }
        let entry = failures.entry(peer).or_insert(Failures {
            count: 0,
            since: Instant::now(),
        });
        if entry.since.elapsed() >= LOCKOUT {
            *entry = Failures {
                count: 0,
                since: Instant::now(),
            };
        }
        entry.count += 1;
        Err(Denied::PinRequired)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const PHONE: IpAddr = IpAddr::V4(std::net::Ipv4Addr::new(192, 168, 1, 23));

    #[test]
    fn this_machine_needs_no_pin() {
        let g = PinGuard::new("1234".into());
        assert_eq!(g.check("127.0.0.1".parse().unwrap(), None), Ok(()));
        assert_eq!(g.check("::1".parse().unwrap(), None), Ok(()));
        assert_eq!(g.check("::ffff:127.0.0.1".parse().unwrap(), None), Ok(()));
    }

    #[test]
    fn other_devices_need_the_right_pin() {
        let g = PinGuard::new("1234".into());
        assert_eq!(g.check(PHONE, None), Err(Denied::PinRequired));
        assert_eq!(g.check(PHONE, Some("0000")), Err(Denied::PinRequired));
        assert_eq!(g.check(PHONE, Some(" 1234 ")), Ok(()));
    }

    #[test]
    fn repeated_wrong_pins_lock_the_address_out() {
        let g = PinGuard::new("1234".into());
        for _ in 0..MAX_FAILURES {
            assert_eq!(g.check(PHONE, Some("9999")), Err(Denied::PinRequired));
        }
        assert_eq!(g.check(PHONE, Some("1234")), Err(Denied::TooManyAttempts));
        // Another device is unaffected.
        let tablet: IpAddr = "192.168.1.40".parse().unwrap();
        assert_eq!(g.check(tablet, Some("1234")), Ok(()));
    }

    #[test]
    fn random_pins_are_four_digits() {
        for _ in 0..50 {
            let g = PinGuard::random();
            assert_eq!(g.pin().len(), 4);
            assert!(g.pin().chars().all(|c| c.is_ascii_digit()));
        }
    }
}
