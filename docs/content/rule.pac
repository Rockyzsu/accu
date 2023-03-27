function FindProxyForURL(url, host) {
    if (dnsDomainIs(host, ".xiaohongshu.com")) {
        return "DIRECT";
    }
    return "SOCKS 127.0.0.1:1080; PROXY 127.0.0.1:1080; DIRECT"
}
