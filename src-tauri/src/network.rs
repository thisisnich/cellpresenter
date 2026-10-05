//! The addresses other devices can use to reach this computer.

use std::net::{IpAddr, Ipv4Addr};

use serde::Serialize;
use ts_rs::TS;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum AddressKind {
    /// The local network (Wi-Fi or Ethernet). What phones in the room use.
    Lan,
    /// Tailscale: works from any device signed in to the same tailnet.
    Tailscale,
}

#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct NetworkAddress {
    pub ip: String,
    pub interface: String,
    pub kind: AddressKind,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export)]
pub struct NetworkInfo {
    /// Port of the embedded server (the one phones connect to).
    pub port: u16,
    /// Best first.
    pub addresses: Vec<NetworkAddress>,
}

/// Interfaces no phone can reach: containers, VMs, bridges.
const VIRTUAL_PREFIXES: [&str; 6] = ["docker", "br-", "veth", "virbr", "vmnet", "lxc"];

fn is_tailscale(name: &str, ip: Ipv4Addr) -> bool {
    // Tailscale hands out addresses from 100.64.0.0/10.
    let [a, b, ..] = ip.octets();
    name.starts_with("tailscale")
        || name.starts_with("utun") && a == 100
        || (a == 100 && (64..128).contains(&b))
}

/// Decide whether an interface address is worth offering, and as what.
pub fn classify(name: &str, ip: IpAddr) -> Option<AddressKind> {
    let IpAddr::V4(v4) = ip else {
        return None; // Phones handle IPv4 URLs best; v6 needs [brackets].
    };
    if v4.is_loopback() || v4.is_link_local() || v4.is_unspecified() {
        return None;
    }
    if VIRTUAL_PREFIXES.iter().any(|p| name.starts_with(p)) {
        return None;
    }
    Some(if is_tailscale(name, v4) {
        AddressKind::Tailscale
    } else {
        AddressKind::Lan
    })
}

pub fn addresses() -> Vec<NetworkAddress> {
    let mut found: Vec<NetworkAddress> = if_addrs::get_if_addrs()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|iface| {
            let kind = classify(&iface.name, iface.ip())?;
            Some(NetworkAddress {
                ip: iface.ip().to_string(),
                interface: iface.name,
                kind,
            })
        })
        .collect();
    found.sort_by(|a, b| {
        a.kind
            .cmp(&b.kind)
            .then_with(|| a.interface.cmp(&b.interface))
    });
    found.dedup_by(|a, b| a.ip == b.ip);
    found
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ip(s: &str) -> IpAddr {
        s.parse().unwrap()
    }

    #[test]
    fn offers_wifi_and_tailscale_but_not_virtual_or_loopback() {
        assert_eq!(
            classify("wlp191s0", ip("192.168.1.20")),
            Some(AddressKind::Lan)
        );
        assert_eq!(classify("eth0", ip("10.0.0.5")), Some(AddressKind::Lan));
        assert_eq!(
            classify("tailscale0", ip("100.98.48.87")),
            Some(AddressKind::Tailscale)
        );
        assert_eq!(
            classify("wg0", ip("100.70.1.2")),
            Some(AddressKind::Tailscale)
        );
        assert_eq!(classify("docker0", ip("172.17.0.1")), None);
        assert_eq!(classify("br-5cae8a67b9f3", ip("172.18.0.1")), None);
        assert_eq!(classify("lo", ip("127.0.0.1")), None);
        assert_eq!(classify("wlan0", ip("169.254.3.4")), None);
        assert_eq!(classify("wlan0", ip("fd7a:115c:a1e0::1")), None);
    }

    #[test]
    fn a_100_address_outside_the_tailscale_range_is_lan() {
        assert_eq!(classify("eth0", ip("100.20.0.1")), Some(AddressKind::Lan));
    }
}
