/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Loader2, Music, Shuffle, Repeat, Repeat1, Maximize2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, useAnimationFrame, useMotionTemplate } from 'motion/react';

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
  
  // New features state
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'all' | 'one'>('none');
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Audio Reactivity Refs & Motion Values
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const isAudioInitialized = useRef(false);

  const audioData = useMotionValue(0);
  const backgroundScale = useTransform(audioData, [0, 1], [1.05, 1.4]);
  const backgroundBrightness = useTransform(audioData, [0, 1], [0.4, 1.3]);
  const orbScale1 = useTransform(audioData, [0, 1], [0.8, 2.2]);
  const orbScale2 = useTransform(audioData, [0, 1], [0.6, 2.0]);
  const expandedArtworkScale = useTransform(audioData, [0, 1], [1, 1.08]);
  const filterTemplate = useMotionTemplate`blur(100px) saturate(200%) brightness(${backgroundBrightness})`;

  // Generate floating particles for background ambiance
  const particles = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      duration: 15 + Math.random() * 25,
      delay: Math.random() * 15,
      size: Math.random() * 4 + 1, // 1px to 5px
      xOffset: Math.random() * 100 - 50,
      opacity: Math.random() * 0.4 + 0.1,
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

  const initAudio = () => {
    if (!audioRef.current || isAudioInitialized.current) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      
      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      isAudioInitialized.current = true;
    } catch (e) {
      console.error("Audio context initialization failed", e);
    }
  };

  const resumeAudioContext = () => {
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  useAnimationFrame(() => {
    if (analyserRef.current && dataArrayRef.current && isPlaying) {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      // Focus on bass frequencies (first few bins)
      let sum = 0;
      const bassBins = 8;
      for (let i = 0; i < bassBins; i++) {
        sum += dataArrayRef.current[i];
      }
      const average = sum / bassBins;
      // Smooth the value using linear interpolation
      const target = Math.min((average / 255) * 1.8, 1); // Boosted sensitivity
      const current = audioData.get();
      audioData.set(current + (target - current) * 0.2);
    } else {
      // Decay smoothly when paused
      const current = audioData.get();
      if (current > 0.01) {
        audioData.set(current * 0.9);
      }
    }
  });

  // Handle Shuffle Logic
  useEffect(() => {
    if (tracks.length > 0) {
      if (isShuffle) {
        const indices = Array.from({ length: tracks.length }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        setShuffledIndices(indices);
      } else {
        setShuffledIndices(Array.from({ length: tracks.length }, (_, i) => i));
      }
    }
  }, [tracks, isShuffle]);

  // Handle Audio Playback
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => {
          console.error("Playback failed", e);
          setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrackIndex]);

  // Handle Volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const handlePlayPause = () => {
    initAudio();
    resumeAudioContext();
    if (currentTrackIndex === -1 && tracks.length > 0) {
      setCurrentTrackIndex(isShuffle ? shuffledIndices[0] : 0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const playTrack = (index: number) => {
    initAudio();
    resumeAudioContext();
    if (currentTrackIndex === index) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrackIndex(index);
      setIsPlaying(true);
    }
  };

  const nextTrack = () => {
    initAudio();
    resumeAudioContext();
    if (tracks.length === 0) return;
    
    if (repeatMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
      return;
    }

    const currentIndexInShuffle = shuffledIndices.indexOf(currentTrackIndex);
    if (currentIndexInShuffle === -1) {
      setCurrentTrackIndex(shuffledIndices[0]);
      setIsPlaying(true);
      return;
    }

    if (currentIndexInShuffle === tracks.length - 1) {
      if (repeatMode === 'all') {
        setCurrentTrackIndex(shuffledIndices[0]);
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
        if (audioRef.current) audioRef.current.currentTime = 0;
      }
    } else {
      setCurrentTrackIndex(shuffledIndices[currentIndexInShuffle + 1]);
      setIsPlaying(true);
    }
  };

  const prevTrack = () => {
    initAudio();
    resumeAudioContext();
    if (tracks.length === 0) return;
    
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    const currentIndexInShuffle = shuffledIndices.indexOf(currentTrackIndex);
    if (currentIndexInShuffle === -1) return;

    if (currentIndexInShuffle === 0) {
      if (repeatMode === 'all') {
        setCurrentTrackIndex(shuffledIndices[tracks.length - 1]);
        setIsPlaying(true);
      } else {
        if (audioRef.current) audioRef.current.currentTime = 0;
      }
    } else {
      setCurrentTrackIndex(shuffledIndices[currentIndexInShuffle - 1]);
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

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleRepeat = () => {
    setRepeatMode(prev => {
      if (prev === 'none') return 'all';
      if (prev === 'all') return 'one';
      return 'none';
    });
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        >
          <Loader2 className="w-10 h-10 text-fuchsia-500" />
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center max-w-md">
          <p className="text-red-400 font-medium">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const currentTrack = currentTrackIndex >= 0 ? tracks[currentTrackIndex] : null;
  const streamUrl = currentTrack ? `https://api.audius.co/v1/tracks/${currentTrack.id}/stream?app_name=${APP_NAME}` : undefined;
  
  const currentArtwork = currentTrack?.artwork?.['1000x1000'] || currentTrack?.artwork?.['480x480'] || playlist?.artwork?.['1000x1000'] || playlist?.artwork?.['480x480'];

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-50 font-sans pb-40 selection:bg-fuchsia-500/30 relative overflow-x-hidden">
      {/* Immersive Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <AnimatePresence>
          {currentArtwork && (
            <motion.div 
              key={currentArtwork}
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: 0.5, 
                x: [0, 20, -20, 0],
                y: [0, -20, 20, 0]
              }}
              exit={{ opacity: 0 }}
              transition={{ 
                opacity: { duration: 2 },
                x: { duration: 35, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
                y: { duration: 30, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }
              }}
              className="absolute inset-0 bg-cover bg-center"
              style={{ 
                backgroundImage: `url(${currentArtwork})`, 
                scale: backgroundScale,
                filter: filterTemplate
              }}
            />
          )}
        </AnimatePresence>
        
        {/* Ambient Orbs */}
        <motion.div
          animate={{
            x: ['0vw', '20vw', '-10vw', '0vw'],
            y: ['0vh', '15vh', '-20vh', '0vh'],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/4 left-1/4 w-[50vw] h-[50vw] bg-fuchsia-600/10 rounded-full blur-[120px] mix-blend-screen"
          style={{ scale: orbScale1 }}
        />
        <motion.div
          animate={{
            x: ['0vw', '-20vw', '15vw', '0vw'],
            y: ['0vh', '-15vh', '20vh', '0vh'],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-1/4 right-1/4 w-[60vw] h-[60vw] bg-violet-600/10 rounded-full blur-[120px] mix-blend-screen"
          style={{ scale: orbScale2 }}
        />

        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/40 via-[#050505]/70 to-[#050505]" />
        
        {/* Floating Dust Particles */}
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute -bottom-10 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
            animate={{
              y: ['0vh', '-120vh'],
              x: [0, particle.xOffset, -particle.xOffset, 0],
              opacity: [0, particle.opacity, particle.opacity, 0],
            }}
            transition={{
              y: { duration: particle.duration, repeat: Infinity, ease: "linear", delay: particle.delay },
              x: { duration: particle.duration / 2, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
              opacity: { duration: particle.duration, repeat: Infinity, ease: "linear", delay: particle.delay },
            }}
            style={{ 
              left: particle.left,
              width: particle.size,
              height: particle.size,
            }}
          />
        ))}
      </div>

      {/* Header Section */}
      <header className="relative z-10 pt-20 pb-12 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center md:items-end gap-8 md:gap-12">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 100 }}
            className="relative group"
          >
            <div className="w-56 h-56 md:w-72 md:h-72 shrink-0 rounded-3xl overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-white/10 bg-zinc-900 relative z-10">
              {playlist?.artwork ? (
                <img 
                  src={playlist.artwork['1000x1000'] || playlist.artwork['480x480']} 
                  alt={playlist.playlist_name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music className="w-20 h-20 text-zinc-700" />
                </div>
              )}
            </div>
            {/* Glow effect behind artwork */}
            <div className="absolute inset-0 bg-fuchsia-500/20 blur-3xl -z-10 rounded-full scale-90 group-hover:scale-110 transition-transform duration-700" />
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center md:text-left flex-1"
          >
            <p className="text-fuchsia-400 font-semibold tracking-[0.2em] uppercase text-xs mb-3">Featured Playlist</p>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60">
              {playlist?.playlist_name}
            </h1>
            <p className="text-zinc-400 max-w-2xl text-sm md:text-base leading-relaxed whitespace-pre-wrap font-light">
              {playlist?.description}
            </p>
            <div className="mt-8 flex items-center justify-center md:justify-start gap-4">
              <button 
                onClick={handlePlayPause}
                className="bg-white hover:bg-zinc-200 text-black rounded-full px-8 py-4 font-semibold tracking-wide flex items-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-white/10"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-5 h-5 fill-current" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" /> Play
                  </>
                )}
              </button>
              <button 
                onClick={() => setIsShuffle(!isShuffle)}
                className={`p-4 rounded-full transition-all ${isShuffle ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'}`}
              >
                <Shuffle className="w-5 h-5" />
              </button>
              <span className="text-zinc-500 text-sm font-medium ml-2">
                {tracks.length} tracks
              </span>
            </div>
          </motion.div>
        </div>
      </header>

      {/* Tracklist Section */}
      <main className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-[auto_1fr_auto] gap-4 px-6 py-3 border-b border-white/10 text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">
          <div className="w-8 text-center">#</div>
          <div>Title</div>
          <div className="text-right">Time</div>
        </div>
        
        <div className="space-y-1">
          {tracks.map((track, index) => {
            const isCurrentTrack = currentTrackIndex === index;
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.015 }}
                key={`${track.id}-${index}`}
                onClick={() => playTrack(index)}
                className={`group grid grid-cols-[auto_1fr_auto] gap-4 items-center px-6 py-3.5 rounded-2xl cursor-pointer transition-all ${
                  isCurrentTrack ? 'bg-white/10 shadow-lg shadow-black/20' : 'hover:bg-white/5'
                }`}
              >
                <div className="w-8 flex justify-center">
                  {isCurrentTrack && isPlaying ? (
                    <div className="flex items-end gap-1 h-4">
                      <motion.div animate={{ height: ['4px', '14px', '4px'] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1 bg-fuchsia-500 rounded-full" />
                      <motion.div animate={{ height: ['8px', '18px', '8px'] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-1 bg-fuchsia-500 rounded-full" />
                      <motion.div animate={{ height: ['6px', '12px', '6px'] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-1 bg-fuchsia-500 rounded-full" />
                    </div>
                  ) : (
                    <span className={`text-sm font-medium ${isCurrentTrack ? 'text-fuchsia-400' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                      {index + 1}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-zinc-800 shadow-md">
                    {track.artwork ? (
                      <img src={track.artwork['150x150']} alt={track.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Music className="w-5 h-5 m-3.5 text-zinc-600" />
                    )}
                  </div>
                  <div className="truncate">
                    <div className={`font-medium text-base truncate transition-colors ${isCurrentTrack ? 'text-white' : 'text-zinc-200 group-hover:text-white'}`}>
                      {track.title}
                    </div>
                    <div className="text-sm text-zinc-500 truncate mt-0.5 group-hover:text-zinc-400 transition-colors">
                      {track.user?.name}
                    </div>
                  </div>
                </div>
                
                <div className="text-sm text-zinc-500 font-medium tabular-nums group-hover:text-zinc-300 transition-colors">
                  {formatTime(track.duration)}
                </div>
              </motion.div>
            );
          })}
        </div>
      </main>

      {/* Floating Glass Player Bar */}
      <AnimatePresence>
        {currentTrack && (
          <motion.div 
            initial={{ y: 150, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 150, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-6 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[calc(100%-2rem)] md:max-w-5xl bg-zinc-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl px-4 py-3 md:px-6 md:py-4 z-50 shadow-2xl shadow-black/80"
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8">
              
              {/* Now Playing Info */}
              <div className="flex items-center gap-4 w-full md:w-1/3 min-w-0">
                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-zinc-800 shadow-lg relative group">
                  {currentTrack.artwork ? (
                    <img src={currentTrack.artwork['150x150']} alt={currentTrack.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Music className="w-6 h-6 m-4 text-zinc-600" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => setIsExpanded(true)}>
                    <Maximize2 className="w-6 h-6 text-white drop-shadow-lg" />
                  </div>
                </div>
                <div className="truncate flex-1">
                  <div className="font-semibold text-base text-white truncate">{currentTrack.title}</div>
                  <div className="text-sm text-zinc-400 truncate mt-0.5">{currentTrack.user?.name}</div>
                </div>
                {/* Mobile Play/Pause (visible only on small screens) */}
                <button 
                  onClick={handlePlayPause}
                  className="md:hidden w-12 h-12 flex shrink-0 items-center justify-center bg-white text-black rounded-full hover:scale-105 active:scale-95 transition-all"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                </button>
              </div>

              {/* Core Controls */}
              <div className="flex flex-col items-center max-w-md w-full gap-3 hidden md:flex">
                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => setIsShuffle(!isShuffle)} 
                    className={`transition-colors ${isShuffle ? 'text-fuchsia-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <Shuffle className="w-4 h-4" />
                  </button>
                  <button onClick={prevTrack} className="text-zinc-300 hover:text-white transition-colors">
                    <SkipBack className="w-5 h-5 fill-current" />
                  </button>
                  <button 
                    onClick={handlePlayPause}
                    className="w-12 h-12 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/10"
                  >
                    {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                  </button>
                  <button onClick={nextTrack} className="text-zinc-300 hover:text-white transition-colors">
                    <SkipForward className="w-5 h-5 fill-current" />
                  </button>
                  <button 
                    onClick={toggleRepeat} 
                    className={`transition-colors ${repeatMode !== 'none' ? 'text-fuchsia-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                  </button>
                </div>
                
                <div className="w-full flex items-center gap-3 text-xs text-zinc-400 font-medium tabular-nums">
                  <span>{formatTime(progress)}</span>
                  <div className="flex-1 relative group flex items-center h-4">
                    <input 
                      type="range" 
                      min={0} 
                      max={duration || 100} 
                      value={progress} 
                      onChange={handleSeek}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-white group-hover:bg-fuchsia-400 transition-colors relative"
                        style={{ width: `${(progress / (duration || 1)) * 100}%` }}
                      />
                    </div>
                    {/* Thumb visual */}
                    <div 
                      className="absolute h-3 w-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                      style={{ left: `calc(${(progress / (duration || 1)) * 100}% - 6px)` }}
                    />
                  </div>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Volume Control */}
              <div className="w-1/3 justify-end hidden md:flex">
                <div className="flex items-center gap-3 w-32 group">
                  <button onClick={toggleMute} className="text-zinc-400 hover:text-white transition-colors">
                    {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <div className="flex-1 relative flex items-center h-4">
                    <input 
                      type="range" 
                      min={0} 
                      max={1} 
                      step={0.01}
                      value={isMuted ? 0 : volume} 
                      onChange={handleVolumeChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-zinc-300 group-hover:bg-white transition-colors"
                        style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>
            
            {/* Mobile Progress Bar */}
            <div className="md:hidden w-full flex items-center gap-3 text-xs text-zinc-400 font-medium tabular-nums mt-3">
              <span>{formatTime(progress)}</span>
              <div className="flex-1 relative flex items-center h-4">
                <input 
                  type="range" 
                  min={0} 
                  max={duration || 100} 
                  value={progress} 
                  onChange={handleSeek}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-fuchsia-400"
                    style={{ width: `${(progress / (duration || 1)) * 100}%` }}
                  />
                </div>
              </div>
              <span>{formatTime(duration)}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Now Playing View */}
      <AnimatePresence>
        {isExpanded && currentTrack && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[100] flex flex-col bg-black/60 backdrop-blur-xl"
          >
            {/* Close Button */}
            <button 
              onClick={() => setIsExpanded(false)}
              className="absolute top-6 right-6 md:top-8 md:right-8 p-3 md:p-4 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-xl transition-all hover:scale-105 active:scale-95 z-50"
            >
              <ChevronDown className="w-6 h-6 md:w-8 md:h-8 text-white" />
            </button>

            <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative z-10 w-full max-w-3xl mx-auto">
              <motion.div 
                style={{ scale: expandedArtworkScale }}
                className="w-[75vw] h-[75vw] max-w-[350px] max-h-[350px] md:max-w-[500px] md:max-h-[500px] rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl shadow-black/80 ring-1 ring-white/20 mb-8 md:mb-12"
              >
                {currentTrack.artwork ? (
                  <img src={currentTrack.artwork['1000x1000'] || currentTrack.artwork['480x480']} alt={currentTrack.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                    <Music className="w-32 h-32 text-zinc-600" />
                  </div>
                )}
              </motion.div>
              
              <div className="text-center w-full px-4 mb-8">
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-3 tracking-tight truncate">{currentTrack.title}</h2>
                <p className="text-lg md:text-2xl text-zinc-400 truncate">{currentTrack.user?.name}</p>
              </div>

              <div className="w-full flex flex-col items-center gap-6 md:gap-8">
                {/* Progress */}
                <div className="w-full flex items-center gap-4 text-sm text-zinc-400 font-medium tabular-nums">
                  <span>{formatTime(progress)}</span>
                  <div className="flex-1 relative group flex items-center h-8">
                    <input 
                      type="range" 
                      min={0} 
                      max={duration || 100} 
                      value={progress} 
                      onChange={handleSeek}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="w-full h-2 bg-zinc-800/80 rounded-full overflow-hidden backdrop-blur-sm">
                      <div 
                        className="h-full bg-fuchsia-400 relative"
                        style={{ width: `${(progress / (duration || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span>{formatTime(duration)}</span>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-6 md:gap-10">
                  <button onClick={() => setIsShuffle(!isShuffle)} className={`transition-colors ${isShuffle ? 'text-fuchsia-400' : 'text-zinc-400 hover:text-white'}`}>
                    <Shuffle className="w-6 h-6 md:w-7 md:h-7" />
                  </button>
                  <button onClick={prevTrack} className="text-zinc-300 hover:text-white transition-colors">
                    <SkipBack className="w-8 h-8 md:w-10 md:h-10 fill-current" />
                  </button>
                  <button 
                    onClick={handlePlayPause}
                    className="w-20 h-20 md:w-24 md:h-24 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10"
                  >
                    {isPlaying ? <Pause className="w-10 h-10 md:w-12 md:h-12 fill-current" /> : <Play className="w-10 h-10 md:w-12 md:h-12 fill-current ml-2" />}
                  </button>
                  <button onClick={nextTrack} className="text-zinc-300 hover:text-white transition-colors">
                    <SkipForward className="w-8 h-8 md:w-10 md:h-10 fill-current" />
                  </button>
                  <button onClick={toggleRepeat} className={`transition-colors ${repeatMode !== 'none' ? 'text-fuchsia-400' : 'text-zinc-400 hover:text-white'}`}>
                    {repeatMode === 'one' ? <Repeat1 className="w-6 h-6 md:w-7 md:h-7" /> : <Repeat className="w-6 h-6 md:w-7 md:h-7" />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden Audio Element */}
      <audio 
        ref={audioRef} 
        src={streamUrl} 
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onEnded={nextTrack}
        onLoadedMetadata={handleTimeUpdate}
      />
    </div>
  );
}
