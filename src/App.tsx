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
        {/* Animated Vector Background */}
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="absolute inset-0 w-full h-full opacity-60"
        >
          <defs>
            <path 
              id="wave" 
              d="M 0,0 Q 50,-25 100,0 T 200,0 T 300,0 T 400,0 T 500,0 T 600,0 L 600,200 L 0,200 Z" 
            />
            
            <pattern 
              id="wavy-pattern" 
              width="200" 
              height="120" 
              patternUnits="userSpaceOnUse" 
              patternTransform="rotate(-25) scale(1.2)"
            >
              <rect width="200" height="120" fill="#ff04fc" />
              
              <g>
                <animateTransform 
                  attributeName="transform" 
                  type="translate" 
                  from="0,0" 
                  to="-200,0" 
                  dur="2s" 
                  repeatCount="indefinite" 
                />
                
                <use href="#wave" y="40" fill="#9503f8" />
                <use href="#wave" y="80" fill="#3d03cf" />
              </g>
            </pattern>

            <mask id="logo-mask">
              <g fill="white">
                <path d="M103.3419,89.643c1.12725,-2.2296 3.17655,-5.52825 4.47075,-7.7793l10.4979,-18.12675l13.3365,-23.1459c3.117,-5.35785 6.8097,-12.6009 11.11245,-17.1228c1.83105,-1.92435 5.5632,-2.7174 8.2245,-2.4738c2.6655,0.2256 5.4735,1.7856 7.1445,3.84405c4.7745,5.88225 8.031,13.20885 12.0795,19.64955c0.138,0.2181 0.0765,0.1026 0.1815,0.3765c0.162,0.13935 2.2575,3.8037 2.5035,4.2303l58.041,100.79295l24.4905,42.5127l6.9915,12.078c0.8835,1.512 2.9085,4.8105 3.63,6.2595c-2.7195,1.788 -6.093,3.288 -9.045,4.7235c-15.2685,7.4295 -32.3655,10.377 -49.128,7.1385c-6.678,-1.29 -12.846,-4.41 -19.0575,-6.9795c2.931,-2.325 4.377,-5.5215 2.4915,-9.1515c-1.5165,-2.9175 -3.153,-5.637 -4.794,-8.4885l-8.715,-15.1605l-13.971,-24.1995c-2.697,-4.7025 -5.379,-9.47685 -8.172,-14.12715c-0.5775,-0.9603 -1.467,-1.8324 -2.436,-2.4c-1.5705,-0.9171 -3.4398,-1.1787 -5.202,-0.7281c-3.51495,0.9333 -4.7976,4.0851 -6.4896,6.9633c-0.6528,-1.065 -1.53795,-3.66345 -1.98645,-4.9083c-0.93885,-2.6499 -1.89705,-5.2929 -2.87445,-7.929c-1.3614,-3.59055 -3.26055,-7.30785 -4.80135,-10.89c-5.2335,-12.16605 -12.4356,-24.10845 -23.619,-31.66965c-1.5708,-1.062 -3.11115,-2.67255 -4.90425,-3.2886z" />
                <path d="M150.984,20.99445c2.6655,0.2256 5.4735,1.7856 7.1445,3.84405c4.7745,5.88225 8.031,13.20885 12.0795,19.64955c0.138,0.2181 0.0765,0.1026 0.1815,0.3765c-1.1205,-0.18855 -1.059,-1.20015 -1.7055,-2.0118c-0.102,0.39975 -0.081,0.39045 -0.327,0.71505c-1.0215,-0.0438 -3.5115,-3.0162 -3.993,-4.10565c-1.0005,-2.244 -0.9615,-4.1514 -3.6915,-5.11785c-2.454,-0.86835 -4.5105,-1.92105 -5.7645,-4.30005c-0.4605,-0.8721 -1.407,-2.1612 -0.249,-2.9688c1.494,-1.04085 -0.567,-1.9224 -0.522,-2.85135c0.222,-0.0207 0.4215,-0.0183 0.6435,-0.00345c0.498,-0.888 -0.321,-0.4707 0.354,-1.4097c-0.63,-0.975 -3.435,-0.86595 -4.1505,-1.8165z" />
                <path d="M170.3895,44.86455c0.162,0.13935 2.2575,3.8037 2.5035,4.2303c-1.005,-0.36495 -1.0815,-0.80415 -1.6845,-1.76955c-0.2565,0.29325 -0.2505,0.273 -0.6,0.45735c-0.51,-0.1461 -0.2745,-0.02235 -0.678,-0.46635l0.024,-0.237c0.408,-0.1827 0.366,-0.09345 0.6225,-0.39375c-0.261,-0.8394 -0.297,-0.9537 -0.1875,-1.821z" />
                <path d="M266.046,210.738c0.486,1.1775 1.2795,2.3655 1.9275,3.4815l3.3795,5.8035c2.9475,5.055 5.8605,10.1295 8.7375,15.2235c0.9495,1.6965 1.9755,3.2535 2.8875,4.9995c0.525,0.7515 0.9225,1.524 1.377,2.3175c3.69,6.447 7.6425,12.8325 10.896,19.5105c1.3245,3.099 2.0625,5.5875 1.0395,8.8455c-1.9185,6.1035 -6.4965,7.7865 -12.4485,8.0475c-4.5,0.198 -8.9715,0.0825 -13.476,0.0795l-22.5675,-0.0045l-68.61,-0.0345l-50.64705,-0.0075l-15.9645,-0.0015c-4.1709,-0.006 -8.415,-0.0225 -12.57285,-0.315c-2.9583,-0.225 -5.9211,-0.804 -8.13585,-2.937c-3.6219,-3.4875 -4.5015,-8.1705 -2.4492,-12.738c1.7646,-3.9285 3.8319,-7.4805 5.95995,-11.184l8.28135,-14.3175l5.45325,-9.48c5.0577,-8.793 5.87235,-11.4225 16.52055,-11.463l40.62585,0.072l12.387,0.021c3.624,0.0045 6.789,0.4095 10.1685,-1.0365c6.2115,2.5695 12.3795,5.6895 19.0575,6.9795c16.7625,3.2385 33.8595,0.291 49.128,-7.1385c2.952,-1.4355 6.3255,-2.9355 9.045,-4.7235z" />
                <path d="M266.046,210.738c0.486,1.1775 1.2795,2.3655 1.9275,3.4815l3.3795,5.8035c2.9475,5.055 5.8605,10.1295 8.7375,15.2235c0.9495,1.6965 1.9755,3.2535 2.8875,4.9995c-1.4925,2.3565 -9.3795,6.7395 -12.168,8.3475c-22.9215,13.2105 -45.3885,18.096 -71.67,14.394c-5.0265,-0.7095 -10.071,-1.554 -14.9745,-2.8815c-22.626,-6.0615 -42.2958,-20.1045 -55.377,-39.5355c-0.93495,-1.362 -2.37615,-2.6505 -3.15435,-4.0065l40.62585,0.072l12.387,0.021c3.624,0.0045 6.789,0.4095 10.1685,-1.0365c6.2115,2.5695 12.3795,5.6895 19.0575,6.9795c16.7625,3.2385 33.8595,0.291 49.128,-7.1385c2.952,-1.4355 6.3255,-2.9355 9.045,-4.7235z" />
                <path d="M75.2025,138.2724c0.7137,-1.54425 2.80155,-4.88175 3.72675,-6.4554l6.23775,-10.7694c6.02115,-10.3764 12.01635,-21.1578 18.1749,-31.4046c1.7931,0.61605 3.33345,2.2266 4.90425,3.2886c11.1834,7.5612 18.3855,19.5036 23.619,31.66965c1.5408,3.58215 3.43995,7.29945 4.80135,10.89c0.9774,2.6361 1.9356,5.2791 2.87445,7.929c0.4485,1.24485 1.33365,3.8433 1.98645,4.9083c-1.99005,3.82845 -4.9014,8.52945 -7.09605,12.32145l-14.3379,24.8025c-2.21025,3.825 -4.80255,8.046 -6.8754,11.865c-2.268,4.116 -4.5858,7.494 -9.555,8.052c-3.46665,0.39 -7.1928,0.258 -10.67925,0.2565l-12.9909,-0.021l-13.557,-0.0525c-4.32135,-0.0195 -12.0477,0.3195 -15.88725,-1.6005c-4.31895,-2.16 -6.9684,-8.3175 -5.0439,-12.9825c2.7276,-6.6135 6.642,-12.801 10.23645,-19.0515z" />
                <path d="M113.21805,197.3175c-2.268,4.116 -4.5858,7.494 -9.555,8.052c-3.46665,0.39 -7.1928,0.258 -10.67925,0.2565l-12.9909,-0.021l-13.557,-0.0525c-4.32135,-0.0195 -12.0477,0.3195 -15.88725,-1.6005c-4.31895,-2.16 -6.9684,-8.3175 -5.0439,-12.9825c2.7276,-6.6135 6.642,-12.801 10.23645,-19.0515l19.4613,-33.6456c2.9811,1.69725 6.76275,6.1152 9.2784,8.6505c1.89795,1.91295 3.50505,5.4156 5.3832,7.4706c2.33085,3.021 4.2492,6.72 6.1446,10.059c3.9075,6.84 7.57095,13.8165 10.983,20.916c0.8484,1.737 5.289,11.0685 6.22635,11.949z" />
              </g>
            </mask>

            <g id="single-logo">
              <rect width="300" height="300" fill="url(#wavy-pattern)" mask="url(#logo-mask)" />
            </g>

            <pattern 
              id="logo-bg-pattern" 
              width="140" 
              height="120" 
              patternUnits="userSpaceOnUse"
            >
              <g>
                <animateTransform 
                  attributeName="transform" 
                  type="translate" 
                  from="0,0" 
                  to="-140,-120" 
                  dur="15s" 
                  repeatCount="indefinite" 
                />
                
                <use href="#single-logo" transform="translate(-35, -60) scale(0.15)" />
                <use href="#single-logo" transform="translate(35, -60) scale(0.15)" />
                <use href="#single-logo" transform="translate(105, -60) scale(0.15)" />
                <use href="#single-logo" transform="translate(175, -60) scale(0.15)" />
                
                <use href="#single-logo" transform="translate(-70, 0) scale(0.15)" />
                <use href="#single-logo" transform="translate(0, 0) scale(0.15)" />
                <use href="#single-logo" transform="translate(70, 0) scale(0.15)" />
                <use href="#single-logo" transform="translate(140, 0) scale(0.15)" />

                <use href="#single-logo" transform="translate(-35, 60) scale(0.15)" />
                <use href="#single-logo" transform="translate(35, 60) scale(0.15)" />
                <use href="#single-logo" transform="translate(105, 60) scale(0.15)" />
                <use href="#single-logo" transform="translate(175, 60) scale(0.15)" />

                <use href="#single-logo" transform="translate(-70, 120) scale(0.15)" />
                <use href="#single-logo" transform="translate(0, 120) scale(0.15)" />
                <use href="#single-logo" transform="translate(70, 120) scale(0.15)" />
                <use href="#single-logo" transform="translate(140, 120) scale(0.15)" />
              </g>
            </pattern>
          </defs>

          <rect width="100%" height="100%" fill="url(#logo-bg-pattern)" />
        </svg>

        <AnimatePresence>
          {currentArtwork && (
            <motion.div 
              key={currentArtwork}
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: 0.15, 
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

        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/20 via-[#050505]/50 to-[#050505]" />
        
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
