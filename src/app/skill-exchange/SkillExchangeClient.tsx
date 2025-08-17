'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, Users, BookOpen, Star, Clock, TrendingUp,
  Search, Filter, Plus, Award, Target, MessageCircle,
  Calendar, MapPin, Zap, Brain, Code, Palette,
  Database, Shield, Globe, Lightbulb, Settings,
  CheckCircle, PlayCircle, PauseCircle, UserCheck,
  ArrowRight, Trophy, Medal, Badge, Bookmark
} from 'lucide-react';

interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  icon: React.ComponentType<any>;
  color: string;
  demand: number; // 1-100
  trendscore: number; // 1-100
}

interface LearningPath {
  id: string;
  title: string;
  description: string;
  skills: string[];
  duration: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  participants: number;
  rating: number;
  thumbnail: string;
  mentor: string;
  tags: string[];
  progress?: number;
}

interface SkillSession {
  id: string;
  title: string;
  skillId: string;
  mentor: string;
  mentorAvatar: string;
  date: Date;
  duration: number; // minutes
  type: 'workshop' | 'mentoring' | 'peer-session' | 'certification';
  location: 'virtual' | 'in-person' | 'hybrid';
  capacity: number;
  enrolled: number;
  description: string;
}

interface UserProgress {
  skillId: string;
  level: number;
  experience: number;
  maxExperience: number;
  certificationsEarned: number;
  timeSpent: number; // hours
  lastActivity: Date;
}

enum SkillCategory {
  DEVELOPMENT = 'development',
  DESIGN = 'design',
  DATA = 'data',
  SECURITY = 'security',
  DEVOPS = 'devops',
  PRODUCT = 'product',
  LEADERSHIP = 'leadership',
  COMMUNICATION = 'communication'
}

// Mock data
const skills: Skill[] = [
  {
    id: '1',
    name: 'React Development',
    category: SkillCategory.DEVELOPMENT,
    description: 'Modern React with hooks, context, and performance optimization',
    difficulty: 'Intermediate',
    icon: Code,
    color: 'blue',
    demand: 95,
    trendscore: 88
  },
  {
    id: '2',
    name: 'System Design',
    category: SkillCategory.DEVELOPMENT,
    description: 'Scalable architecture and distributed systems design',
    difficulty: 'Advanced',
    icon: Database,
    color: 'purple',
    demand: 92,
    trendscore: 85
  },
  {
    id: '3',
    name: 'UX Research',
    category: SkillCategory.DESIGN,
    description: 'User research methodologies and data-driven design',
    difficulty: 'Intermediate',
    icon: Palette,
    color: 'pink',
    demand: 78,
    trendscore: 82
  },
  {
    id: '4',
    name: 'Kubernetes',
    category: SkillCategory.DEVOPS,
    description: 'Container orchestration and cloud-native deployments',
    difficulty: 'Advanced',
    icon: Globe,
    color: 'green',
    demand: 89,
    trendscore: 91
  },
  {
    id: '5',
    name: 'Security Auditing',
    category: SkillCategory.SECURITY,
    description: 'Application security testing and vulnerability assessment',
    difficulty: 'Expert',
    icon: Shield,
    color: 'red',
    demand: 85,
    trendscore: 87
  },
  {
    id: '6',
    name: 'Technical Leadership',
    category: SkillCategory.LEADERSHIP,
    description: 'Leading engineering teams and technical decision making',
    difficulty: 'Advanced',
    icon: Users,
    color: 'orange',
    demand: 88,
    trendscore: 79
  }
];

const learningPaths: LearningPath[] = [
  {
    id: '1',
    title: 'Full-Stack Developer Track',
    description: 'Complete journey from frontend to backend development',
    skills: ['1', '2', '4'],
    duration: '12 weeks',
    difficulty: 'Intermediate',
    participants: 156,
    rating: 4.8,
    thumbnail: '/api/placeholder/300/200',
    mentor: 'Sarah Chen',
    tags: ['React', 'Node.js', 'PostgreSQL', 'AWS'],
    progress: 65
  },
  {
    id: '2',
    title: 'Security Engineering Path',
    description: 'Comprehensive security training for engineers',
    skills: ['5', '2'],
    duration: '8 weeks',
    difficulty: 'Advanced',
    participants: 89,
    rating: 4.9,
    thumbnail: '/api/placeholder/300/200',
    mentor: 'Alex Rodriguez',
    tags: ['Security', 'Penetration Testing', 'OWASP'],
    progress: 30
  },
  {
    id: '3',
    title: 'Product Design Fundamentals',
    description: 'User-centered design thinking and prototyping',
    skills: ['3'],
    duration: '6 weeks',
    difficulty: 'Beginner',
    participants: 234,
    rating: 4.7,
    thumbnail: '/api/placeholder/300/200',
    mentor: 'Maria Santos',
    tags: ['Figma', 'User Research', 'Prototyping']
  }
];

const upcomingSessions: SkillSession[] = [
  {
    id: '1',
    title: 'Advanced React Patterns Workshop',
    skillId: '1',
    mentor: 'David Kim',
    mentorAvatar: '/api/placeholder/40/40',
    date: new Date('2024-01-18T14:00:00Z'),
    duration: 90,
    type: 'workshop',
    location: 'virtual',
    capacity: 25,
    enrolled: 18,
    description: 'Deep dive into advanced React patterns including render props, compound components, and hooks optimization'
  },
  {
    id: '2',
    title: 'System Design Office Hours',
    skillId: '2',
    mentor: 'Jennifer Liu',
    mentorAvatar: '/api/placeholder/40/40',
    date: new Date('2024-01-19T16:30:00Z'),
    duration: 60,
    type: 'mentoring',
    location: 'virtual',
    capacity: 10,
    enrolled: 7,
    description: 'Q&A session on system design principles and architecture decisions'
  },
  {
    id: '3',
    title: 'Kubernetes Certification Prep',
    skillId: '4',
    mentor: 'Michael Torres',
    mentorAvatar: '/api/placeholder/40/40',
    date: new Date('2024-01-20T10:00:00Z'),
    duration: 120,
    type: 'certification',
    location: 'in-person',
    capacity: 15,
    enrolled: 12,
    description: 'Hands-on preparation for CKA certification with real-world scenarios'
  }
];

const userProgress: Record<string, UserProgress> = {
  '1': {
    skillId: '1',
    level: 3,
    experience: 750,
    maxExperience: 1000,
    certificationsEarned: 1,
    timeSpent: 45,
    lastActivity: new Date('2024-01-15')
  },
  '2': {
    skillId: '2',
    level: 2,
    experience: 320,
    maxExperience: 600,
    certificationsEarned: 0,
    timeSpent: 28,
    lastActivity: new Date('2024-01-14')
  }
};

export default function SkillExchangeClient() {
  const [activeTab, setActiveTab] = useState<'discover' | 'paths' | 'sessions' | 'progress'>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | 'all'>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');

  const categories = Object.values(SkillCategory);
  const difficulties = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

  const filteredSkills = skills.filter(skill => {
    const matchesSearch = skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         skill.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || skill.category === selectedCategory;
    const matchesDifficulty = selectedDifficulty === 'all' || skill.difficulty === selectedDifficulty;
    
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'text-green-600 bg-green-100 border-green-200';
      case 'Intermediate': return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'Advanced': return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'Expert': return 'text-red-600 bg-red-100 border-red-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getSessionTypeIcon = (type: string) => {
    switch (type) {
      case 'workshop': return BookOpen;
      case 'mentoring': return Users;
      case 'peer-session': return MessageCircle;
      case 'certification': return Award;
      default: return BookOpen;
    }
  };

  const renderDiscoverTab = () => (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="spotify-card p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="spotify-input pl-10 w-full"
            />
          </div>
          
          <div className="flex gap-4">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as SkillCategory | 'all')}
              className="spotify-input"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category} className="capitalize">
                  {category.replace('_', ' ')}
                </option>
              ))}
            </select>
            
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="spotify-input"
            >
              <option value="all">All Levels</option>
              {difficulties.map(difficulty => (
                <option key={difficulty} value={difficulty}>
                  {difficulty}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Skills Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSkills.map((skill, index) => {
          const SkillIcon = skill.icon;
          const progress = userProgress[skill.id];
          
          return (
            <motion.div
              key={skill.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="spotify-plugin-card group cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl bg-${skill.color}-500/10`}>
                  <SkillIcon className={`h-6 w-6 text-${skill.color}-600`} />
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${getDifficultyColor(skill.difficulty)}`}>
                  {skill.difficulty}
                </div>
              </div>

              <h3 className="text-lg font-bold text-foreground mb-2">{skill.name}</h3>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{skill.description}</p>

              {progress && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Level {progress.level}</span>
                    <span className="text-sm text-muted-foreground">
                      {progress.experience}/{progress.maxExperience} XP
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(progress.experience / progress.maxExperience) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-600">{skill.demand}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">{skill.trendscore}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 spotify-button-primary py-2 px-4 rounded-lg text-sm font-semibold">
                  {progress ? 'Continue' : 'Start Learning'}
                </button>
                <button className="p-2 rounded-lg border border-border hover:border-primary/20 transition-all">
                  <Bookmark className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  const renderPathsTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {learningPaths.map((path, index) => (
        <motion.div
          key={path.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="spotify-plugin-card group cursor-pointer"
        >
          <div className="relative mb-4">
            <div className="w-full h-32 bg-gradient-to-r from-primary/20 to-accent/20 rounded-lg" />
            <div className="absolute top-3 right-3">
              <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${getDifficultyColor(path.difficulty)}`}>
                {path.difficulty}
              </div>
            </div>
            {path.progress && (
              <div className="absolute bottom-3 left-3 right-3">
                <div className="bg-background/90 rounded-lg p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">Progress</span>
                    <span className="text-xs font-medium">{path.progress}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div 
                      className="bg-primary h-1.5 rounded-full"
                      style={{ width: `${path.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <h3 className="text-lg font-bold text-foreground mb-2">{path.title}</h3>
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{path.description}</p>

          <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{path.duration}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{path.participants}</span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 text-yellow-600" />
              <span>{path.rating}</span>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">by {path.mentor}</span>
          </div>

          <div className="flex flex-wrap gap-1 mb-4">
            {path.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="px-2 py-1 bg-muted rounded text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>

          <button className="w-full spotify-button-primary py-2 px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
            {path.progress ? <PlayCircle className="h-4 w-4" /> : <Target className="h-4 w-4" />}
            {path.progress ? 'Continue Path' : 'Start Path'}
          </button>
        </motion.div>
      ))}
    </div>
  );

  const renderSessionsTab = () => (
    <div className="space-y-6">
      {upcomingSessions.map((session, index) => {
        const SessionIcon = getSessionTypeIcon(session.type);
        const skill = skills.find(s => s.id === session.skillId);
        
        return (
          <motion.div
            key={session.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="spotify-card p-6 hover:spotify-card-hover cursor-pointer"
          >
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <SessionIcon className="h-6 w-6 text-primary" />
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">{session.title}</h3>
                    {skill && (
                      <p className="text-sm text-primary font-medium">{skill.name}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">
                      {session.date.toLocaleDateString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {session.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-4">{session.description}</p>

                <div className="flex items-center gap-6 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-muted rounded-full" />
                    <span className="text-sm text-foreground">{session.mentor}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{session.duration} min</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="capitalize">{session.location}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{session.enrolled}/{session.capacity}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    session.type === 'workshop' ? 'bg-blue-100 text-blue-600' :
                    session.type === 'mentoring' ? 'bg-green-100 text-green-600' :
                    session.type === 'certification' ? 'bg-purple-100 text-purple-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {session.type.replace('-', ' ')}
                  </div>
                  
                  <button className="spotify-button-primary py-2 px-6 rounded-lg text-sm font-semibold">
                    Join Session
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );

  const renderProgressTab = () => {
    const progressEntries = Object.entries(userProgress);
    
    return (
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Skills in Progress', value: progressEntries.length, icon: Target },
            { label: 'Total XP Earned', value: progressEntries.reduce((sum, [_, p]) => sum + p.experience, 0), icon: Star },
            { label: 'Certifications', value: progressEntries.reduce((sum, [_, p]) => sum + p.certificationsEarned, 0), icon: Award },
            { label: 'Learning Hours', value: Math.round(progressEntries.reduce((sum, [_, p]) => sum + p.timeSpent, 0)), icon: Clock }
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="spotify-card p-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                  <stat.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Progress Details */}
        <div className="space-y-4">
          {progressEntries.map(([skillId, progress], index) => {
            const skill = skills.find(s => s.id === skillId);
            if (!skill) return null;
            
            const SkillIcon = skill.icon;
            const progressPercentage = (progress.experience / progress.maxExperience) * 100;
            
            return (
              <motion.div
                key={skillId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="spotify-card p-6"
              >
                <div className="flex items-center gap-6">
                  <div className={`p-4 rounded-xl bg-${skill.color}-500/10`}>
                    <SkillIcon className={`h-8 w-8 text-${skill.color}-600`} />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-foreground">{skill.name}</h3>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          Level {progress.level}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {Math.round(progress.timeSpent)}h spent
                        </span>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-muted-foreground">
                          {progress.experience}/{progress.maxExperience} XP
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {Math.round(progressPercentage)}%
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3">
                        <div 
                          className="bg-primary h-3 rounded-full transition-all duration-500"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {progress.certificationsEarned > 0 && (
                          <div className="flex items-center gap-1">
                            <Medal className="h-4 w-4 text-yellow-600" />
                            <span className="text-sm font-medium text-yellow-600">
                              {progress.certificationsEarned} certified
                            </span>
                          </div>
                        )}
                        <span className="text-sm text-muted-foreground">
                          Last activity: {progress.lastActivity.toLocaleDateString()}
                        </span>
                      </div>
                      
                      <button className="spotify-button-primary py-2 px-4 rounded-lg text-sm font-semibold flex items-center gap-2">
                        <PlayCircle className="h-4 w-4" />
                        Continue
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="spotify-layout min-h-screen">
      <div className="spotify-main-content">
        {/* Header */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-6"
          >
            <div>
              <div className="flex items-center gap-3 mb-2">
                <GraduationCap className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold spotify-gradient-text">Skill Exchange</h1>
                <span className="bg-gradient-to-r from-primary to-accent text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold">
                  Premium
                </span>
              </div>
              <p className="text-muted-foreground">
                Internal learning marketplace for skill development and knowledge sharing
              </p>
            </div>
            <button className="spotify-button-primary px-6 py-3 rounded-xl font-semibold flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configure Exchange
            </button>
          </motion.div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1 bg-muted/30 p-1 rounded-xl w-fit">
            {[
              { id: 'discover', label: 'Discover Skills', icon: Search },
              { id: 'paths', label: 'Learning Paths', icon: BookOpen },
              { id: 'sessions', label: 'Sessions', icon: Calendar },
              { id: 'progress', label: 'My Progress', icon: TrendingUp }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? 'spotify-tab-active'
                    : 'spotify-tab-inactive'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'discover' && renderDiscoverTab()}
            {activeTab === 'paths' && renderPathsTab()}
            {activeTab === 'sessions' && renderSessionsTab()}
            {activeTab === 'progress' && renderProgressTab()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}