function FindProxyForURL(url, host) {
    if (dnsDomainIs(host, ".xiaohongshu.com")) {
        return "SOCKS5 127.0.0.1:1080";
    }
    return "SOCKS 127.0.0.1:1080"
}
