//源代码来自：https://github.com/byJoey/cfnew/blob/main/snippets
//更新时间：2025-09-28
//修改：仅保留 IPv4 + TLS 节点

import { connect } from 'cloudflare:sockets';

// --- 硬编码配置 ---
// UUID，同时用作订阅路径。
const authToken = '351c9981-04b6-4103-aa4b-864aa9c91469';
// 用来访问cloudflare托管的网站
const fallbackAddress = 'ProxyIP.cmliussss.net';
const fallbackPort = '443';
// SOCKS5 代理配置。留空则禁用。格式: user:pass@host:port
const socks5Config = '';

const directDomains = [
    { name: "cloudflare.182682.xyz", domain: "cloudflare.182682.xyz" },,{ domain: "eur.ccav.xx.kg" },{ domain: "cmcc.ccav.xx.kg" },{ domain: "cu.ccav.xx.kg" },
    { domain: "freeyx.cloudflare88.eu.org" }, { domain: "bestcf.top" }, { domain: "cdn.2020111.xyz" },{ domain: "skk.moe" },{ domain: "www.visa.com.hk" },
    { domain: "cf.0sm.com" }, { domain: "cf.090227.xyz" }, { domain: "cf.zhetengsha.eu.org" }, { domain: "ip.sb" },{ domain: "time.is" },{ domain: "www.visa.com.tw" },
    { domain: "cfip.1323123.xyz" }, { domain: "cnamefuckxxs.yuchen.icu" }, { domain: "cloudflare-ip.mofashi.ltd" },{ domain: "trump.com" },
    { domain: "cdn.tzpro.xyz" }, { domain: "xn--b6gac.eu.org" }, { domain: "ct.ccav.xx.kg" },{ domain: "na.ccav.xx.kg" },{ domain: "www.visa.com.sg" },
    { domain: "bestcf.top" },{ domain: "cdn.2020111.xyz" },{ domain: "cf.0sm.com" },{ domain: "asia.ccav.xx.kg" },
    { domain: "cf.877774.xyz" },{ domain: "cfip.1323123.xyz" },{ domain: "cfip.xxxxxxxx.tk" },{ domain: "cloudflare-ip.mofashi.ltd" },{ domain: "cloudflare.182682.xyz" },
    { domain: "snipaste2.speedip.eu.org" },{ domain: "snipaste4.speedip.eu.org" },{ domain: "wetest.xn--vip-ob6fs36j.cloudflare.182682.xyz" },{ domain: "xn--b6gac.eu.org" },
    { domain: "xn--ktff-jt6hr36l.tencentapp.cn" },{ domain: "cdns.doon.eu.org" },{ domain: "cf.zhetengsha.eu.org" },{ domain: "cf.090227.xyz" },{ domain: "cf.ccav.xx.kg" }
];

const parsedSocks5Config = {};
const isSocksEnabled = false;

// 错误常量省略（保持不变）

const ADDRESS_TYPE_IPV4 = 1;
const ADDRESS_TYPE_URL = 2;
const ADDRESS_TYPE_IPV6 = 3;

export default {
	async fetch(request, env, ctx) {
		try {
			const subPath = authToken;
			const url = new URL(request.url);

			if (request.headers.get('Upgrade') === 'websocket') {
				return await handleWsRequest(request);
			} else if (request.method === 'GET') {
				if (url.pathname === '/') {
					const successHtml = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>部署成功</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background-color:#121212;color:#e0e0e0;text-align:center;}.container{padding:2rem;border-radius:8px;background-color:#1e1e1e;box-shadow:0 4px 6px rgba(0,0,0,0.1);}h1{color:#4caf50;}</style></head><body><div class="container"><h1>✅ 部署成功</h1><p>代理与动态订阅功能均已启用。</p></div></body></html>`;
					return new Response(successHtml, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
				}
				if (url.pathname.toLowerCase().includes(`/${subPath}`)) {
					return await handleSubscriptionRequest(request, authToken);
				}
			}
			return new Response('Not Found', { status: 404 });
		} catch (err) {
			return new Response(err.toString(), { status: 500 });
		}
	},
};

async function handleSubscriptionRequest(request, uuid) {
    const url = new URL(request.url);
    const finalLinks = [];
    const workerDomain = url.hostname;

    const nativeList = [{ ip: workerDomain, isp: '原生地址' }];
    finalLinks.push(...generateLinksFromSource(nativeList, uuid, workerDomain));

    const domainList = directDomains.map(d => ({ ip: d.domain, isp: d.name || d.domain }));
    finalLinks.push(...generateLinksFromSource(domainList, uuid, workerDomain));

    const dynamicIPList = await fetchDynamicIPs();
    if (dynamicIPList.length > 0) {
        finalLinks.push(...generateLinksFromSource(dynamicIPList, uuid, workerDomain));
    }

    const subscriptionContent = btoa(finalLinks.join('\n'));
    
    return new Response(subscriptionContent, {
        headers: { 
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
    });
}

// ✅ 只保留 TLS + IPv4 节点
function generateLinksFromSource(list, uuid, workerDomain) {
    const httpsPorts = [443];
    const links = [];
    const wsPath = encodeURIComponent('/?ed=2048');
    const proto = 'vless';

    list.forEach(item => {
        const nodeNameBase = item.isp.replace(/\s/g, '_');
        const safeIP = item.ip.includes(':') ? `[${item.ip}]` : item.ip;

        httpsPorts.forEach(port => {
            const wsNodeName = `${nodeNameBase}-${port}-WS-TLS`;
            const wsParams = new URLSearchParams({ 
                encryption: 'none', 
                security: 'tls', 
                sni: workerDomain, 
                fp: 'randomized', 
                type: 'ws', 
                host: workerDomain, 
                path: wsPath 
            });
            links.push(`${proto}://${uuid}@${safeIP}:${port}?${wsParams.toString()}#${encodeURIComponent(wsNodeName)}`);
        });
    });
    return links;
}

// ✅ 动态获取 IP，只取 IPv4
async function fetchDynamicIPs() {
    const v4Url1 = "https://www.wetest.vip/page/cloudflare/address_v4.html";
    let results = [];

    try {
        const ipv4List = await fetchAndParseWetest(v4Url1);
        results = [...ipv4List];
        if (results.length > 0) {
            console.log(`Successfully fetched ${results.length} IPv4 IPs from wetest.vip`);
            return results;
        }
    } catch (e) {
        console.error("Failed to fetch IPv4 from wetest.vip:", e);
    }

    console.log("wetest.vip IPv4 failed, trying fallback IP source...");
    const fallbackUrl = "https://stock.hostmonit.com/CloudFlareYes";
    try {
        const response = await fetch(fallbackUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!response.ok) {
            console.error(`Fallback source failed with status: ${response.status}`);
            return [];
        }
        const html = await response.text();
        const rowRegex = /<tr><td>([\d.]+)<\/td><td>.*?<\/td><td>.*?<\/td><td>.*?<\/td><td>(.*?)<\/td>.*?<\/tr>/g;
        
        let match;
        while ((match = rowRegex.exec(html)) !== null) {
            if (match[1] && match[2]) {
                results.push({
                    ip: match[1].trim(),
                    isp: match[2].trim().replace(/\s/g, '')
                });
            }
        }

        if (results.length > 0) {
             console.log(`Successfully fetched ${results.length} IPv4 IPs from fallback source.`);
        } else {
            console.warn(`Warning: Could not parse any IPv4 IPs from fallback source. The site structure might have changed.`);
        }
       
        return results;
    } catch (e) {
        console.error("Failed to fetch from fallback source:", e);
        return [];
    }
}

async function fetchAndParseWetest(url) {
    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!response.ok) {
            console.error(`Failed to fetch ${url}, status: ${response.status}`);
            return [];
        }
        const html = await response.text();
        const results = [];
        const rowRegex = /<tr[\s\S]*?<\/tr>/g;
        const cellRegex = /<td data-label="线路名称">(.+?)<\/td>[\s\S]*?<td data-label="优选地址">([\d.]+)<\/td>/;

        let match;
        while ((match = rowRegex.exec(html)) !== null) {
            const rowHtml = match[0];
            const cellMatch = rowHtml.match(cellRegex);
            if (cellMatch && cellMatch[1] && cellMatch[2]) {
                results.push({
                    isp: cellMatch[1].trim().replace(/<.*?>/g, ''),
                    ip: cellMatch[2].trim()
                });
            }
        }
        
        if (results.length === 0) {
            console.warn(`Warning: Could not parse any IPv4 IPs from ${url}. The site structure might have changed.`);
        }

        return results;
    } catch (error) {
        console.error(`Error parsing ${url}:`, error);
        return [];
    }
}

// 下面 WebSocket 和 TCP/UDP 转发的逻辑保持不变（原样）
