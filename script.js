class NeteaseMusic {
    constructor() {
        this.baseUrl = 'https://apis.netstart.cn/music';
        this.playlistId = '14185195349'; // 默认歌单ID
        this.currentPlaylist = '精选';
        this.playlistCache = new Map(); // 歌单缓存
        this.audio = null; // 音频对象
        this.currentSong = null; // 当前播放的歌曲
        this.isPlaying = false; // 播放状态
        this.init();
    }

    init() {
        this.loadPlaylist();
        this.bindPlaylistButtons();
        this.initPlayerControls();
    }

    // 初始化播放控制
    initPlayerControls() {
        // 获取播放控制元素
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.progressBar = document.getElementById('progressBar');
        this.currentTimeDisplay = document.getElementById('currentTime');
        this.totalTimeDisplay = document.getElementById('totalTime');
        this.currentSongNameDisplay = document.getElementById('currentSongName');
        
        // 获取HTML中的audio标签
        this.audio = document.getElementById('audioPlayer');
        
        // 绑定事件监听器
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.progressBar.addEventListener('input', () => this.seek());
        
        // 为audio标签添加事件监听
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('ended', () => this.onSongEnd());
        this.audio.addEventListener('error', (e) => this.onAudioError(e));
        this.audio.addEventListener('canplaythrough', () => this.onAudioReady());
    }

    // 获取当前歌单的歌曲列表
    getCurrentSongs() {
        const cachedData = this.playlistCache.get(this.playlistId);
        return cachedData ? cachedData.songsList : [];
    }

    // 滚动到指定歌曲
    scrollToSong(songId) {
        const songItem = document.querySelector(`.song-item[data-song-id="${songId}"]`);
        if (songItem) {
            songItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // 添加高亮效果
            document.querySelectorAll('.song-item').forEach(item => {
                item.classList.remove('active');
            });
            songItem.classList.add('active');
        }
    }

    // 渲染歌曲列表时更新选择器
    renderSongsList(songs) {
        const container = document.getElementById('songsList');
        
        if (!songs || songs.length === 0) {
            container.innerHTML = '<div class="error">该歌单暂无歌曲</div>';
            return;
        }

        let html = '';
        songs.forEach((song, index) => {
            const duration = this.formatDuration(song.dt);
            const albumName = song.al ? song.al.name : '未知专辑';
            const albumCover = song.al ? song.al.picUrl : '';
            
            html += `
                <div class="song-item" data-song-id="${song.id}">
                    <div class="song-index">${index + 1}</div>
                    ${albumCover ? `<img src="${albumCover}?param=40y40" alt="${albumName}" class="album-cover">` : ''}
                    <div class="song-info">
                        <div class="song-name">${song.name}</div>
                        <div class="song-artist">${song.ar.map(artist => artist.name).join(' / ')}</div>
                        <div class="song-album">${albumName}</div>
                    </div>
                    <div class="song-duration">${duration}</div>
                </div>
            `;
        });

        container.innerHTML = html;
        
        // 为每个歌曲项添加点击事件监听器
        const songItems = container.querySelectorAll('.song-item');
        songItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const songId = item.getAttribute('data-song-id');
                // 找到对应的歌曲对象
                const song = songs.find(s => s.id == songId);
                if (song) {
                    this.play(song);
                }
            });
        });
    }

    // 播放歌曲
    async play(song = null) {
        try {
            // 如果传入了歌曲，则设置为当前歌曲
            if (song) {
                this.currentSong = song;
                
                // 重置播放状态
                this.isPlaying = false;
                this.playPauseBtn.textContent = '▶';
                this.progressBar.value = 0;
                this.currentTimeDisplay.textContent = '0:00';
                this.totalTimeDisplay.textContent = this.formatDuration(song.dt);
                
                // 直接使用API URL，让浏览器处理重定向
                const songUrl = this.fetchSongUrl(song.id);
                this.audio.src = songUrl;
                
                // 更新显示的歌曲名称
                this.currentSongNameDisplay.textContent = song.name;
                
                // 等待音频加载
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('音频加载超时'));
                    }, 10000); // 10秒超时
                    
                    this.audio.addEventListener('canplaythrough', () => {
                        clearTimeout(timeout);
                        resolve();
                    }, { once: true });
                    
                    this.audio.addEventListener('error', (e) => {
                        clearTimeout(timeout);
                        reject(new Error('音频加载失败'));
                    }, { once: true });
                });
            }

            // 播放音频
            await this.audio.play();
            this.isPlaying = true;
            this.playPauseBtn.textContent = '⏸'; // 更改为暂停图标
            
            // 滚动到当前播放的歌曲
            if (song) {
                this.scrollToSong(song.id);
            }
        } catch (error) {
            console.error('播放失败:', error);
            this.currentSongNameDisplay.textContent = `播放失败: ${error.message}`;
            this.isPlaying = false;
            this.playPauseBtn.textContent = '▶';
            this.progressBar.value = 0;
            this.currentTimeDisplay.textContent = '0:00';
        }
    }

    // 切换播放/暂停状态
    togglePlayPause() {
        if (!this.currentSong) {
            // 如果没有当前歌曲，尝试播放第一首
            const songs = document.querySelectorAll('.song-item');
            if (songs.length > 0) {
                songs[0].click();
                return;
            }
        }

        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    // 暂停播放
    pause() {
        this.audio.pause();
        this.isPlaying = false;
        this.playPauseBtn.textContent = '▶'; // 更改为播放图标
    }

    // 跳转到指定位置
    seek() {
        if (!this.audio.duration || !isFinite(this.audio.duration)) {
            return; // 如果音频时长无效，不执行跳转
        }
        const seekTime = (this.progressBar.value / 100) * this.audio.duration;
        this.audio.currentTime = seekTime;
    }

    // 更新进度条
    updateProgress() {
        if (this.audio.duration && isFinite(this.audio.duration)) {
            const progressPercent = (this.audio.currentTime / this.audio.duration) * 100;
            this.progressBar.value = progressPercent;
            this.currentTimeDisplay.textContent = this.formatDuration(this.audio.currentTime * 1000);
        }
    }

    // 歌曲播放结束处理
    onSongEnd() {
        this.isPlaying = false;
        this.playPauseBtn.textContent = '▶';
        this.progressBar.value = 0;
        this.currentTimeDisplay.textContent = '0:00';
    }

    // 音频错误处理
    onAudioError(e) {
        console.error('音频播放错误:', e);
        this.currentSongNameDisplay.textContent = '音频播放错误';
        this.isPlaying = false;
        this.playPauseBtn.textContent = '▶';
        this.progressBar.value = 0;
        this.currentTimeDisplay.textContent = '0:00';
    }

    // 音频准备就绪
    onAudioReady() {
        console.log('音频准备就绪，可以播放');
    }

    // 获取歌曲播放URL - 简化版本，直接返回API URL
    fetchSongUrl(songId) {
        return `https://api.injahow.cn/meting/?type=url&id=${songId}`;
    }

    // 绑定歌单按钮点击事件
    bindPlaylistButtons() {
        const buttons = document.querySelectorAll('.playlist-btn');
        buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                const playlistId = e.target.getAttribute('data-playlist-id');
                const playlistName = e.target.textContent;
                
                // 更新按钮状态
                buttons.forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                
                // 切换歌单
                this.switchPlaylist(playlistId, playlistName);
            });
        });
    }

    // 切换歌单
    switchPlaylist(playlistId, playlistName) {
        this.playlistId = playlistId;
        this.currentPlaylist = playlistName;
        
        // 更新footer链接
        const footerLink = document.querySelector('.playlist-link');
        footerLink.href = `https://music.163.com/#/playlist?id=${playlistId}`;
        footerLink.textContent = `前往网易云音乐查看${playlistName}歌单`;
        
        // 检查缓存中是否有该歌单数据
        if (this.playlistCache.has(playlistId)) {
            // 从缓存加载
            const cachedData = this.playlistCache.get(playlistId);
            this.renderPlaylistDetail(cachedData.playlistDetail);
            this.renderSongsList(cachedData.songsList);
        } else {
            // 显示加载状态
            document.getElementById('playlistDetail').innerHTML = '<div class="loading">加载中...</div>';
            document.getElementById('songsList').innerHTML = '<div class="loading">加载中...</div>';
            
            // 加载新歌单
            this.loadPlaylist();
        }
    }

    // 加载歌单详情和歌曲列表
    async loadPlaylist() {
        try {
            // 检查缓存
            if (this.playlistCache.has(this.playlistId)) {
                const cachedData = this.playlistCache.get(this.playlistId);
                this.renderPlaylistDetail(cachedData.playlistDetail);
                this.renderSongsList(cachedData.songsList);
                return;
            }

            // 并行加载歌单详情和歌曲列表
            const [playlistDetail, songsList] = await Promise.all([
                this.fetchPlaylistDetail(this.playlistId),
                this.fetchPlaylistSongs(this.playlistId)
            ]);

            // 缓存数据
            this.playlistCache.set(this.playlistId, {
                playlistDetail: playlistDetail,
                songsList: songsList,
                timestamp: Date.now()
            });

            this.renderPlaylistDetail(playlistDetail);
            this.renderSongsList(songsList);

        } catch (error) {
            console.error('加载失败:', error);
            this.showError('playlistDetail', '加载歌单失败: ' + error.message);
            this.showError('songsList', '加载歌曲失败: ' + error.message);
        }
    }

    // 获取歌单详情
    async fetchPlaylistDetail(playlistId) {
        const url = `${this.baseUrl}/playlist/detail?id=${playlistId}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.code !== 200) {
            throw new Error(data.message || '获取歌单详情失败');
        }
        
        return data.playlist;
    }

    // 获取歌单所有歌曲
    async fetchPlaylistSongs(playlistId) {
        const url = `${this.baseUrl}/playlist/track/all?id=${playlistId}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.code !== 200) {
            throw new Error(data.message || '获取歌曲列表失败');
        }
        
        return data.songs;
    }

    // 渲染歌单详情
    renderPlaylistDetail(playlist) {
        const container = document.getElementById('playlistDetail');
        
        const html = `
            <div class="playlist-info">
                <img src="${playlist.coverImgUrl}?param=200y200" alt="${playlist.name}" class="playlist-cover">
                <div class="playlist-title">${playlist.name}</div>
                <div class="playlist-creator">
                    <img src="${playlist.creator.avatarUrl}?param=40y40" alt="${playlist.creator.nickname}" class="creator-avatar">
                    <span>创建者: ${playlist.creator.nickname}</span>
                </div>
                <div class="playlist-stats">
                    <div class="playlist-stat">
                        <div class="number">${this.formatNumber(playlist.playCount)}</div>
                        <div class="label">播放次数</div>
                    </div>
                    <div class="playlist-stat">
                        <div class="number">${playlist.trackCount}</div>
                        <div class="label">歌曲数量</div>
                    </div>
                    <div class="playlist-stat">
                        <div class="number">${this.formatNumber(playlist.subscribedCount)}</div>
                        <div class="label">收藏数</div>
                    </div>
                </div>
                <div class="playlist-description">${playlist.description || '暂无描述'}</div>
            </div>
        `;
        
        container.innerHTML = html;
    }

    // 渲染歌曲列表
    renderSongsList(songs) {
        const container = document.getElementById('songsList');
        
        if (!songs || songs.length === 0) {
            container.innerHTML = '<div class="error">该歌单暂无歌曲</div>';
            return;
        }

        let html = '';
        songs.forEach((song, index) => {
            const duration = this.formatDuration(song.dt);
            const albumName = song.al ? song.al.name : '未知专辑';
            const albumCover = song.al ? song.al.picUrl : '';
            
            html += `
                <div class="song-item" data-song-id="${song.id}">
                    <div class="song-index">${index + 1}</div>
                    ${albumCover ? `<img src="${albumCover}?param=40y40" alt="${albumName}" class="album-cover">` : ''}
                    <div class="song-info">
                        <div class="song-name">${song.name}</div>
                        <div class="song-artist">${song.ar.map(artist => artist.name).join(' / ')}</div>
                        <div class="song-album">${albumName}</div>
                    </div>
                    <div class="song-duration">${duration}</div>
                </div>
            `;
        });

        container.innerHTML = html;
        
        // 为每个歌曲项添加点击事件监听器
        const songItems = container.querySelectorAll('.song-item');
        songItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const songId = item.getAttribute('data-song-id');
                // 找到对应的歌曲对象
                const song = songs.find(s => s.id == songId);
                if (song) {
                    this.play(song);
                }
            });
        });
    }

    // 工具函数：格式化数字
    formatNumber(num) {
        if (!num) return '0';
        if (num >= 100000000) {
            return (num / 100000000).toFixed(1) + '亿';
        } else if (num >= 10000) {
            return (num / 10000).toFixed(1) + '万';
        }
        return num.toString();
    }

    // 工具函数：格式化时长
    formatDuration(ms) {
        if (!ms) return '0:00';
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    // 工具函数：格式化时间戳
    formatTime(timestamp) {
        if (!timestamp) return '未知';
        const date = new Date(timestamp);
        return date.toLocaleDateString('zh-CN');
    }

    // 显示错误信息
    showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `<div class="error">${message}</div>`;
        }
    }

    // 清空缓存（可选功能）
    clearCache() {
        this.playlistCache.clear();
        console.log('缓存已清空');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    new NeteaseMusic();
});