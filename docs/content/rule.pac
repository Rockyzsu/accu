function FindProxyForURL(url, host) {
    return [
        "SOCKS5 127.0.0.1:1080",
        "SOCKS  127.0.0.1:1080",
        "PROXY  127.0.0.1:1080",
        "DIRECT"
    ].join("; ")
}
