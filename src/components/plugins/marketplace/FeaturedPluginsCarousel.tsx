'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Star,
  Download,
  Award,
  CheckCircle,
  Loader2,
  ExternalLink,
  Info,
  Play,
  Pause,
} from 'lucide-react';
import type { BackstagePlugin } from '@/services/backstage/plugin-registry';

interface FeaturedPluginsCarouselProps {
  plugins: BackstagePlugin[];
  onPluginSelect: (pluginId: string) => void;
  onInstallPlugin: (pluginId: string) => void;
  installingPlugin?: string | null;
}

interface FeaturedPluginCardProps {
  plugin: BackstagePlugin;
  onSelect: () => void;
  onInstall: () => void;
  isInstalling?: boolean;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function FeaturedPluginCard({ plugin, onSelect, onInstall, isInstalling = false }: FeaturedPluginCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div className="relative group">
      {/* Background Card */}
      <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 rounded-2xl p-1 shadow-lg hover:shadow-xl transition-shadow duration-300">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 h-full">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 
                className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                onClick={onSelect}
              >
                {plugin.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                by {plugin.author}
              </p>
              <p className="text-gray-700 dark:text-gray-300 text-sm line-clamp-3 mb-4">
                {plugin.description}
              </p>
            </div>
            
            {/* Plugin Icon/Logo */}
            <div className="ml-4 w-16 h-16 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                {plugin.title.charAt(0)}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Download className="w-4 h-4 text-blue-600 mr-1" />
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {formatNumber(plugin.downloads || 0)}
                </span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Downloads</span>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Star className="w-4 h-4 text-yellow-500 mr-1" />
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {plugin.rating?.toFixed(1) || 'N/A'}
                </span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Rating</span>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Award className="w-4 h-4 text-purple-600 mr-1" />
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {plugin.featured ? 'Yes' : 'No'}
                </span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Featured</span>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-6">
            {plugin.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
              >
                {tag}
              </span>
            ))}
            {plugin.tags.length > 3 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                +{plugin.tags.length - 3}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {!plugin.installed ? (
              <button
                onClick={onInstall}
                disabled={isInstalling}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isInstalling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Installing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Install
                  </>
                )}
              </button>
            ) : (
              <div className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300 text-sm font-medium rounded-lg">
                <CheckCircle className="w-4 h-4 mr-2" />
                Installed
              </div>
            )}
            
            <button
              onClick={onSelect}
              className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <Info className="w-4 h-4 mr-2" />
              Details
            </button>
          </div>

          {/* Badges */}
          <div className="absolute top-6 left-6 flex flex-col gap-1">
            {plugin.official && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-600 text-white">
                <Award className="w-3 h-3 mr-1" />
                Official
              </span>
            )}
            {plugin.featured && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-500 text-white">
                <Star className="w-3 h-3 mr-1" />
                Featured
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Hover Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-indigo-700/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </div>
  );
}

export function FeaturedPluginsCarousel({ 
  plugins, 
  onPluginSelect, 
  onInstallPlugin, 
  installingPlugin 
}: FeaturedPluginsCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);
  const autoPlayRef = useRef<NodeJS.Timeout>();

  const itemsPerView = 3; // Number of cards to show at once
  const maxIndex = Math.max(0, plugins.length - itemsPerView);

  const nextSlide = () => {
    setCurrentIndex(prev => (prev >= maxIndex ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentIndex(prev => (prev <= 0 ? maxIndex : prev - 1));
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(Math.min(index, maxIndex));
  };

  // Auto-play functionality
  useEffect(() => {
    if (isAutoPlaying && plugins.length > itemsPerView) {
      autoPlayRef.current = setInterval(nextSlide, 5000);
    }
    
    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [isAutoPlaying, plugins.length, itemsPerView]);

  const pauseAutoPlay = () => {
    setIsAutoPlaying(false);
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
    }
  };

  const resumeAutoPlay = () => {
    setIsAutoPlaying(true);
  };

  if (plugins.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Featured Plugins
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Handpicked plugins recommended by the Backstage community
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {plugins.length > itemsPerView && (
            <>
              <button
                onClick={isAutoPlaying ? pauseAutoPlay : resumeAutoPlay}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={isAutoPlaying ? 'Pause autoplay' : 'Resume autoplay'}
              >
                {isAutoPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              
              <button
                onClick={prevSlide}
                disabled={currentIndex === 0}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <button
                onClick={nextSlide}
                disabled={currentIndex >= maxIndex}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Carousel */}
      <div className="relative overflow-hidden">
        <div
          ref={carouselRef}
          className="flex transition-transform duration-500 ease-in-out gap-6"
          style={{
            transform: `translateX(-${currentIndex * (100 / itemsPerView)}%)`,
            width: `${(plugins.length * 100) / itemsPerView}%`,
          }}
          onMouseEnter={pauseAutoPlay}
          onMouseLeave={resumeAutoPlay}
        >
          {plugins.map((plugin, index) => (
            <div
              key={plugin.id}
              className="flex-shrink-0"
              style={{ width: `${100 / plugins.length}%` }}
            >
              <FeaturedPluginCard
                plugin={plugin}
                onSelect={() => onPluginSelect(plugin.id)}
                onInstall={() => onInstallPlugin(plugin.id)}
                isInstalling={installingPlugin === plugin.id}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Dots Indicator */}
      {plugins.length > itemsPerView && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: maxIndex + 1 }, (_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex
                  ? 'bg-blue-600'
                  : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
              }`}
            />
          ))}
        </div>
      )}

      {/* Progress Bar for Auto-play */}
      {isAutoPlaying && plugins.length > itemsPerView && (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-100 ease-linear"
            style={{
              animation: 'progress 5s linear infinite',
            }}
          />
        </div>
      )}

      <style jsx>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}