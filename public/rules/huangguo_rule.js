/**
 * 黄果短剧 - WFTVIOS 通用模版规则
 * 规范: WFTV / TVBox / DRpy 标准规则引擎
 */

var rule = {
    title: '黄果短剧',
    host: 'https://huangguoai.com',
    url: '/fyclass/fypage/',
    class_name: 'AI短剧&AI漫剧&AI魔改&AI换脸',
    class_url: 'ai-duanju&ai-manju&ai-mogai&ai-huanlian',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Referer': 'https://huangguoai.com/'
    },
    category: function(tid, pg) {
        tid = tid || 'ai-duanju';
        pg = parseInt(pg) || 1;
        var listUrl = pg === 1 ? (rule.host + '/' + tid + '/') : (rule.host + '/' + tid + '/' + pg + '/');
        var resp = request(listUrl, { headers: rule.headers, timeout: 10 });
        var html = (resp && resp.text) ? resp.text : (typeof resp === 'string' ? resp : '');
        var vodList = [];
        var cardRegex = /<div\b[^>]*class="[^"]*hg-drama-card[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
        var match;
        while ((match = cardRegex.exec(html)) !== null) {
            var block = match[1];
            var idMatch = block.match(/\/video\/(\d+)\//);
            if (!idMatch) continue;
            var vid = idMatch[1];
            var titleMatch = block.match(/class="hg-drama-card__title"[^>]*><a[^>]*>([^<]+)/) || block.match(/title=["']([^"']+)["']/);
            var title = titleMatch ? titleMatch[1].trim() : ('短剧 ' + vid);
            var picMatch = block.match(/data-src=["']([^"']+)["']/) || block.match(/src=["']([^"']+)["']/);
            var pic = picMatch ? picMatch[1] : '';
            var descMatch = block.match(/class="hg-drama-card__desc">([^<]+)/);
            vodList.push({ vod_id: vid, vod_name: title, vod_pic: pic, vod_remarks: descMatch ? descMatch[1].substring(0, 15) : '全集短剧' });
        }
        return { code: 1, msg: '数据列表', page: pg, pagecount: 50, limit: vodList.length, total: 1000, list: vodList };
    },
    detail: function(vid) {
        vid = String(vid).trim();
        var url = rule.host + '/video/' + vid + '/';
        var resp = request(url, { headers: rule.headers, timeout: 10 });
        var html = (resp && resp.text) ? resp.text : (typeof resp === 'string' ? resp : '');
        var title = '短剧 ' + vid;
        var pic = '';
        var intro = '';
        var videoSrc = '';
        var epSrcs = {};
        var initialMatch = html.match(/id=["']videoInitialData["'][^>]*>([\s\S]*?)<\/script>/);
        if (initialMatch) {
            try {
                var data = JSON.parse(initialMatch[1]);
                title = data.title || title;
                pic = data.posterSrc || data.coverSrc || '';
                intro = data.description || '';
                videoSrc = data.videoSrc || '';
                epSrcs = data.epPlaySrcs || {};
            } catch (e) {}
        }
        var epNums = [];
        var epIdRegex = /data-ep-id=["'](\d+)["']/g;
        var epLinkRegex = new RegExp('/video/' + vid + '/ep-(\\d+)/', 'g');
        var epM;
        while ((epM = epIdRegex.exec(html)) !== null) {
            var n = parseInt(epM[1]);
            if (epNums.indexOf(n) === -1) epNums.push(n);
        }
        while ((epM = epLinkRegex.exec(html)) !== null) {
            var n = parseInt(epM[1]);
            if (epNums.indexOf(n) === -1) epNums.push(n);
        }
        if (epNums.indexOf(1) === -1) epNums.push(1);
        epNums.sort(function(a, b) { return a - b; });

        var playList = [];
        for (var i = 0; i < epNums.length; i++) {
            var ep = epNums[i];
            var epStr = String(ep);
            if (epSrcs[epStr]) {
                playList.push('第' + ep + '集$' + epSrcs[epStr]);
            } else if (ep === 1 && videoSrc) {
                playList.push('第1集$' + videoSrc);
            } else {
                playList.push('第' + ep + '集$' + rule.host + '/video/' + vid + '/ep-' + ep + '/');
            }
        }
        return {
            vod_id: vid,
            vod_name: title,
            vod_pic: pic,
            vod_remarks: '全' + playList.length + '集',
            vod_content: intro,
            vod_play_from: '黄果短剧',
            vod_play_url: playList.join('#')
        };
    },
    play: function(flag, id, flags) {
        var playUrl = String(id || flag || '');
        if (playUrl.indexOf('.m3u8') !== -1 || playUrl.indexOf('.mp4') !== -1) {
            return { url: playUrl, headers: rule.headers };
        }
        var resp = request(playUrl, { headers: rule.headers, timeout: 8 });
        var html = (resp && resp.text) ? resp.text : (typeof resp === 'string' ? resp : '');
        var initialMatch = html.match(/id=["']videoInitialData["'][^>]*>([\s\S]*?)<\/script>/);
        if (initialMatch) {
            try {
                var data = JSON.parse(initialMatch[1]);
                if (data.videoSrc) return { url: data.videoSrc, headers: rule.headers };
            } catch(e) {}
        }
        return { url: '', headers: rule.headers };
    }
};
