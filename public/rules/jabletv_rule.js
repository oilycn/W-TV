/**
 * Jable.TV - WFTVIOS 通用模版规则
 * 规范: WFTV / TVBox / DRpy 标准规则引擎
 */

var rule = {
    title: 'Jable.TV',
    host: 'https://jable.tv',
    url: '/fyclass/?from=fypage',
    searchUrl: '/search/**/?from=fypage',
    searchable: 1,
    quickSearch: 0,
    filterable: 1,
    headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        'Referer': 'https://jable.tv/'
    },
    class_name: '最新更新&热门影片&中文字幕&无码破解&FC2精选&素人专区&巨乳美胸&熟女人妻&制服诱惑&角色扮演&潮吹内射',
    class_url: 'latest-updates&hot&categories/chinese-subtitle&categories/mosaic-removed&categories/fc2&categories/amateur&categories/big-tits&categories/milf&categories/uniform&categories/cosplay&categories/creampie',
    home: function() {
        var names = rule.class_name.split('&');
        var urls = rule.class_url.split('&');
        var cats = [];
        for (var i = 0; i < names.length; i++) {
            if (names[i] && urls[i]) cats.push({ type_id: urls[i], type_name: names[i] });
        }
        var firstList = [];
        try {
            var res = this.category('latest-updates', 1);
            firstList = (res && res.list) ? res.list : [];
        } catch (e) {}
        return {
            code: 1,
            msg: '数据列表',
            class: cats,
            list: firstList
        };
    },
    category: function(tid, pg) {
        tid = (tid || 'latest-updates').replace(/^\/+|\/+$/g, '');
        pg = parseInt(pg) || 1;
        var baseUrl = rule.host + '/' + tid + '/';
        var listUrl = pg <= 1 ? baseUrl : (baseUrl + '?from=' + pg);
        var resp = null;
        try {
            resp = request(listUrl, { headers: rule.headers, timeout: 15 });
        } catch (e) {}
        var html = (resp && resp.text) ? resp.text : (typeof resp === 'string' ? resp : '');
        var vodList = [];
        var cardRegex = /<div\b[^>]*class="[^"]*(?:video-img-box|img-box)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
        var match;
        while ((match = cardRegex.exec(html)) !== null) {
            var block = match[1];
            var idMatch = block.match(/\/videos\/([a-zA-Z0-9_-]+)\//);
            if (!idMatch) continue;
            var vid = idMatch[1];
            var titleMatch = block.match(/<h6\b[^>]*class="[^"]*title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) ||
                             block.match(/class="[^"]*title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([^<]+)/i) ||
                             block.match(/alt=["']([^"']+)["']/);
            var title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : vid;
            var picMatch = block.match(/data-src=["']([^"']+)["']/) || block.match(/data-original=["']([^"']+)["']/) || block.match(/src=["']([^"']+)["']/);
            var labelMatch = block.match(/class="[^"]*label[^"]*"[^>]*>([^<]+)<\/div>/i);
            vodList.push({
                vod_id: vid,
                vod_name: title,
                vod_pic: picMatch ? picMatch[1] : '',
                vod_remarks: labelMatch ? labelMatch[1].trim() : '高清'
            });
        }
        return { code: 1, msg: '数据列表', page: pg, pagecount: 50, limit: vodList.length, total: 1000, list: vodList };
    },
    detail: function(vid) {
        vid = String(vid).trim();
        var url = rule.host + '/videos/' + vid + '/';
        var resp = request(url, { headers: rule.headers, timeout: 12 });
        var html = (resp && resp.text) ? resp.text : (typeof resp === 'string' ? resp : '');
        var titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
        var title = titleMatch ? titleMatch[1].replace(/- Jable\.TV.*/i, '').trim() : vid;
        var picMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
        var hlsMatch = html.match(/var\s+hlsUrl\s*=\s*['"]([^'"]+)['"]/i) ||
                       html.match(/hlsUrl\s*=\s*['"]([^'"]+)['"]/i) ||
                       html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);
        var m3u8Url = hlsMatch ? hlsMatch[1] : ('proxy:' + vid);
        return {
            vod_id: vid,
            vod_name: title,
            vod_pic: picMatch ? picMatch[1] : '',
            vod_remarks: '高清正版',
            vod_content: title,
            vod_play_from: 'JableHLS',
            vod_play_url: '正片$' + m3u8Url
        };
    },
    play: function(flag, id, flags) {
        var playUrl = String(id || flag || '').trim();
        if (playUrl.indexOf('.m3u8') !== -1 || playUrl.indexOf('.mp4') !== -1) {
            return {
                url: playUrl,
                headers: {
                    'User-Agent': rule.headers['User-Agent'],
                    'Referer': rule.host + '/'
                }
            };
        }
        var vid = playUrl.replace(/^proxy:/, '').replace(/\/$/, '').split('/').pop();
        if (vid) {
            var url = rule.host + '/videos/' + vid + '/';
            var resp = request(url, { headers: rule.headers, timeout: 12 });
            var html = (resp && resp.text) ? resp.text : (typeof resp === 'string' ? resp : '');
            var m = html.match(/var\s+hlsUrl\s*=\s*['"]([^'"]+)['"]/i) ||
                    html.match(/hlsUrl\s*=\s*['"]([^'"]+)['"]/i) ||
                    html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);
            if (m && m[1]) {
                return {
                    url: m[1],
                    headers: {
                        'User-Agent': rule.headers['User-Agent'],
                        'Referer': rule.host + '/'
                    }
                };
            }
        }
        return { url: '', headers: rule.headers };
    }
};
