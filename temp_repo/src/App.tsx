/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Loader2, Music } from 'lucide-react';
import { motion } from 'motion/react';

const APP_NAME = 'womens_history_month_app';
const PLAYLIST_API_URL = `https://api.audius.co/v1/playlists/dp2Vo4m?app_name=${APP_NAME}`;

export default function App() {
  const [playlist, setPlaylist] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const audioRef = useRef<HTMLAudioElement>(null);

  const floatingNotes = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      duration: 15 + Math.random() * 25,
      delay: Math.random() * 15,
      size: 16 + Math.random() * 40,
      xOffset: Math.random() * 150 - 75,
    }));
  }, []);

  useEffect(() => {
    fetch(PLAYLIST_API_URL)
      .then(res => res.json())
      .then(data => {
        if (data && data.data && data.data.length > 0) {
          setPlaylist(data.data[0]);
          setTracks(data.data[0].tracks || []);
        } else {
          setError('Failed to load playlist data.');
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Error fetching playlist.');
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("Playback failed", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrackIndex]);

  const handlePlayPause = () => {
    if (currentTrackIndex === -1 && tracks.length > 0) {
      setCurrentTrackIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const playTrack = (index: number) => {
    if (currentTrackIndex === index) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrackIndex(index);
      setIsPlaying(true);
    }
  };

  const nextTrack = () => {
    if (tracks.length > 0) {
      setCurrentTrackIndex((prev) => (prev + 1) % tracks.length);
      setIsPlaying(true);
    }
  };

  const prevTrack = () => {
    if (tracks.length > 0) {
      setCurrentTrackIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  const currentTrack = currentTrackIndex >= 0 ? tracks[currentTrackIndex] : null;
  const streamUrl = currentTrack ? `https://api.audius.co/v1/tracks/${currentTrack.id}/stream?app_name=${APP_NAME}` : '';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans pb-32 selection:bg-fuchsia-500/30 relative">
      {/* Floating Notes Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {floatingNotes.map((note) => (
          <motion.div
            key={note.id}
            className="absolute -bottom-20 text-fuchsia-500/10"
            animate={{
              y: ['0vh', '-120vh'],
              x: [0, note.xOffset],
              opacity: [0, 0.6, 0.6, 0],
              rotate: [0, 360],
            }}
            transition={{
              duration: note.duration,
              delay: note.delay,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{ left: note.left }}
          >
            <Music size={note.size} />
          </motion.div>
        ))}
      </div>

      {/* Header */}
      <header className="relative overflow-hidden bg-zinc-900/50 border-b border-white/5 z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-fuchsia-900/20 to-zinc-950/80 backdrop-blur-3xl" />
        <div className="max-w-6xl mx-auto px-6 py-12 md:py-20 relative z-10 flex flex-col md:flex-row items-center md:items-end gap-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-48 h-48 md:w-64 md:h-64 shrink-0 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10"
          >
            {playlist?.artwork ? (
              <img 
                src={playlist.artwork['1000x1000'] || playlist.artwork['480x480']} 
                alt={playlist.playlist_name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                <Music className="w-16 h-16 text-zinc-600" />
              </div>
            )}
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center md:text-left flex-1"
          >
            <p className="text-fuchsia-400 font-medium tracking-widest uppercase text-sm mb-2">Playlist</p>
            <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight text-white">
              {playlist?.playlist_name}
            </h1>
            <p className="text-zinc-400 max-w-2xl text-sm md:text-base leading-relaxed whitespace-pre-wrap">
              {playlist?.description}
            </p>
            <div className="mt-6 flex items-center justify-center md:justify-start gap-4">
              <button 
                onClick={handlePlayPause}
                className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-full p-4 shadow-lg shadow-fuchsia-900/20 transition-all hover:scale-105 active:scale-95"
              >
                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
              </button>
              <span className="text-zinc-500 text-sm font-medium">
                {tracks.length} tracks
              </span>
            </div>
          </motion.div>
        </div>
      </header>

      {/* Tracklist */}
      <main className="max-w-6xl mx-auto px-6 py-8 relative z-10">
        <div className="grid grid-cols-[auto_1fr_auto] gap-4 px-4 py-2 border-b border-white/5 text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">
          <div className="w-8 text-center">#</div>
          <div>Title</div>
          <div className="text-right">Duration</div>
        </div>
        
        <div className="space-y-1">
          {tracks.map((track, index) => {
            const isCurrentTrack = currentTrackIndex === index;
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                key={track.id}
                onClick={() => playTrack(index)}
                className={`group grid grid-cols-[auto_1fr_auto] gap-4 items-center px-4 py-3 rounded-xl cursor-pointer transition-colors ${
                  isCurrentTrack ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="w-8 flex justify-center">
                  {isCurrentTrack && isPlaying ? (
                    <div className="flex items-end gap-0.5 h-4">
                      <motion.div animate={{ height: ['4px', '12px', '4px'] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1 bg-fuchsia-500 rounded-full" />
                      <motion.div animate={{ height: ['8px', '16px', '8px'] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-1 bg-fuchsia-500 rounded-full" />
                      <motion.div animate={{ height: ['6px', '10px', '6px'] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-1 bg-fuchsia-500 rounded-full" />
                    </div>
                  ) : (
                    <span className={`text-sm ${isCurrentTrack ? 'text-fuchsia-500' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                      {index + 1}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="w-10 h-10 rounded overflow-hidden shrink-0 bg-zinc-800">
                    {track.artwork ? (
                      <img src={track.artwork['150x150']} alt={track.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Music className="w-5 h-5 m-2.5 text-zinc-600" />
                    )}
                  </div>
                  <div className="truncate">
                    <div className={`font-medium truncate ${isCurrentTrack ? 'text-fuchsia-400' : 'text-zinc-100'}`}>
                      {track.title}
                    </div>
                    <div className="text-sm text-zinc-500 truncate mt-0.5">
                      {track.user?.name}
                    </div>
                  </div>
                </div>
                
                <div className="text-sm text-zinc-500 tabular-nums">
                  {formatTime(track.duration)}
                </div>
              </motion.div>
            );
          })}
        </div>
      </main>

      {/* Player Bar */}
      {currentTrack && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl border-t border-white/10 px-4 py-3 md:px-6 md:py-4 z-50"
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 md:gap-8">
            
            {/* Now Playing Info */}
            <div className="flex items-center gap-3 w-1/3 min-w-0">
              <div className="w-12 h-12 rounded-md overflow-hidden shrink-0 bg-zinc-800 hidden md:block">
                {currentTrack.artwork ? (
                  <img src={currentTrack.artwork['150x150']} alt={currentTrack.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Music className="w-6 h-6 m-3 text-zinc-600" />
                )}
              </div>
              <div className="truncate">
                <div className="font-medium text-sm text-white truncate">{currentTrack.title}</div>
                <div className="text-xs text-zinc-400 truncate mt-0.5">{currentTrack.user?.name}</div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center max-w-md w-full gap-2">
              <div className="flex items-center gap-4 md:gap-6">
                <button onClick={prevTrack} className="text-zinc-400 hover:text-white transition-colors">
                  <SkipBack className="w-5 h-5 fill-current" />
                </button>
                <button 
                  onClick={handlePlayPause}
                  className="w-10 h-10 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 active:scale-95 transition-all"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                </button>
                <button onClick={nextTrack} className="text-zinc-400 hover:text-white transition-colors">
                  <SkipForward className="w-5 h-5 fill-current" />
                </button>
              </div>
              
              <div className="w-full flex items-center gap-3 text-xs text-zinc-500 font-medium tabular-nums">
                <span>{formatTime(progress)}</span>
                <input 
                  type="range" 
                  min={0} 
                  max={duration || 100} 
                  value={progress} 
                  onChange={handleSeek}
                  className="flex-1 h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
                  style={{
                    background: `linear-gradient(to right, #d946ef ${(progress / (duration || 1)) * 100}%, #27272a ${(progress / (duration || 1)) * 100}%)`
                  }}
                />
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Volume / Extra */}
            <div className="w-1/3 flex justify-end hidden md:flex">
               <div className="flex items-center gap-2 text-zinc-400">
                 <Volume2 className="w-5 h-5" />
                 <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                   <div className="h-full bg-zinc-400 w-2/3 rounded-full" />
                 </div>
               </div>
            </div>

          </div>
        </motion.div>
      )}

      {/* Hidden Audio Element */}
      <audio 
        ref={audioRef} 
        src={streamUrl} 
        onTimeUpdate={handleTimeUpdate}
        onEnded={nextTrack}
        onLoadedMetadata={handleTimeUpdate}
      />
    </div>
  );
}
