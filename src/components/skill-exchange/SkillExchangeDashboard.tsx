'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, BookOpen, MessageSquare, Star, Clock, MapPin,
  Search, Filter, Plus, Heart, Eye, Award, TrendingUp,
  Calendar, Globe, Code, Palette, Database, Shield,
  Lightbulb, Target, Coffee, Video, Send, X,
  User, Mail, Phone, Linkedin, Github, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Skill {
  id: string;
  name: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  color: string;
}

interface Person {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  title: string;
  department: string;
  location: string;
  timezone: string;
  bio: string;
  skills: Skill[];
  teachingSkills: string[];
  learningSkills: string[];
  mentoring: boolean;
  availability: string;
  experience: number;
  rating: number;
  reviews: number;
  connections: number;
  sessions: number;
  languages: string[];
  socialLinks: {
    linkedin?: string;
    github?: string;
    twitter?: string;
  };
}

interface SkillRequest {
  id: string;
  title: string;
  description: string;
  requester: Person;
  skillNeeded: string;
  category: string;
  urgency: 'low' | 'medium' | 'high';
  duration: string;
  format: 'one-on-one' | 'group' | 'workshop' | 'pairing';
  budget?: number;
  deadline?: string;
  status: 'open' | 'in-progress' | 'completed' | 'cancelled';
  applicants: number;
  createdAt: string;
  tags: string[];
}

interface MentorshipProgram {
  id: string;
  title: string;
  description: string;
  mentor: Person;
  category: string;
  duration: string;
  participants: number;
  maxParticipants: number;
  startDate: string;
  status: 'recruiting' | 'active' | 'completed';
  rating: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
}

interface LearningSession {
  id: string;
  title: string;
  description: string;
  host: Person;
  category: string;
  type: 'workshop' | 'talk' | 'demo' | 'q&a' | 'coding-session';
  date: string;
  duration: number;
  capacity: number;
  registered: number;
  location: 'virtual' | 'in-person' | 'hybrid';
  level: string;
  tags: string[];
  materials?: string[];
}

const SKILL_CATEGORIES = [
  {
    id: 'frontend',
    name: 'Frontend Development',
    icon: Code,
    color: 'text-blue-600 bg-blue-100',
    skills: ['React', 'Vue.js', 'Angular', 'TypeScript', 'CSS', 'HTML']
  },
  {
    id: 'backend',
    name: 'Backend Development',
    icon: Database,
    color: 'text-green-600 bg-green-100',
    skills: ['Node.js', 'Python', 'Java', 'Go', 'API Design', 'Microservices']
  },
  {
    id: 'devops',
    name: 'DevOps & Infrastructure',
    icon: Shield,
    color: 'text-purple-600 bg-purple-100',
    skills: ['Docker', 'Kubernetes', 'AWS', 'CI/CD', 'Terraform', 'Monitoring']
  },
  {
    id: 'design',
    name: 'Design & UX',
    icon: Palette,
    color: 'text-pink-600 bg-pink-100',
    skills: ['UI Design', 'UX Research', 'Figma', 'Prototyping', 'User Testing']
  },
  {
    id: 'data',
    name: 'Data & Analytics',
    icon: TrendingUp,
    color: 'text-orange-600 bg-orange-100',
    skills: ['SQL', 'Python', 'Machine Learning', 'Data Visualization', 'Analytics']
  },
  {
    id: 'product',
    name: 'Product & Strategy',
    icon: Target,
    color: 'text-indigo-600 bg-indigo-100',
    skills: ['Product Management', 'Strategy', 'Roadmapping', 'Market Research']
  }
];

export default function SkillExchangeDashboard() {
  const [activeTab, setActiveTab] = useState<'marketplace' | 'mentorship' | 'sessions' | 'profile'>('marketplace');
  const [people, setPeople] = useState<Person[]>([]);
  const [skillRequests, setSkillRequests] = useState<SkillRequest[]>([]);
  const [mentorshipPrograms, setMentorshipPrograms] = useState<MentorshipProgram[]>([]);
  const [learningSessions, setLearningSessions] = useState<LearningSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  useEffect(() => {
    fetchSkillExchangeData();
  }, []);

  const fetchSkillExchangeData = async () => {
    setLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockPeople: Person[] = [
      {
        id: 'alice',
        name: 'Alice Johnson',
        email: 'alice.johnson@company.com',
        title: 'Senior Frontend Developer',
        department: 'Engineering',
        location: 'San Francisco, CA',
        timezone: 'PST',
        bio: 'Passionate about React and modern frontend technologies. Love sharing knowledge and helping others grow.',
        skills: [
          { id: 'react', name: 'React', category: 'frontend', level: 'expert', color: 'text-blue-600' },
          { id: 'typescript', name: 'TypeScript', category: 'frontend', level: 'advanced', color: 'text-blue-500' }
        ],
        teachingSkills: ['React', 'TypeScript', 'CSS', 'Performance Optimization'],
        learningSkills: ['GraphQL', 'Next.js', 'Testing'],
        mentoring: true,
        availability: 'Weekdays 2-4 PM PST',
        experience: 6,
        rating: 4.8,
        reviews: 23,
        connections: 45,
        sessions: 12,
        languages: ['English', 'Spanish'],
        socialLinks: {
          github: 'https://github.com/alice',
          linkedin: 'https://linkedin.com/in/alice'
        }
      },
      {
        id: 'bob',
        name: 'Bob Chen',
        email: 'bob.chen@company.com',
        title: 'DevOps Engineer',
        department: 'Platform',
        location: 'New York, NY',
        timezone: 'EST',
        bio: 'Cloud infrastructure expert with focus on Kubernetes and automation. Always happy to help with DevOps challenges.',
        skills: [
          { id: 'kubernetes', name: 'Kubernetes', category: 'devops', level: 'expert', color: 'text-purple-600' },
          { id: 'aws', name: 'AWS', category: 'devops', level: 'advanced', color: 'text-orange-500' }
        ],
        teachingSkills: ['Kubernetes', 'Docker', 'AWS', 'CI/CD'],
        learningSkills: ['Service Mesh', 'Security'],
        mentoring: true,
        availability: 'Flexible',
        experience: 8,
        rating: 4.9,
        reviews: 31,
        connections: 62,
        sessions: 18,
        languages: ['English', 'Mandarin'],
        socialLinks: {
          github: 'https://github.com/bobchen',
          linkedin: 'https://linkedin.com/in/bobchen'
        }
      }
    ];

    const mockSkillRequests: SkillRequest[] = [
      {
        id: 'req1',
        title: 'Need help with React Performance Optimization',
        description: 'Looking for someone to help optimize a large React application with performance issues.',
        requester: mockPeople[0],
        skillNeeded: 'React Performance',
        category: 'frontend',
        urgency: 'high',
        duration: '2-3 sessions',
        format: 'one-on-one',
        status: 'open',
        applicants: 3,
        createdAt: new Date().toISOString(),
        tags: ['React', 'Performance', 'Optimization']
      },
      {
        id: 'req2',
        title: 'Kubernetes Workshop for Team',
        description: 'Need someone to conduct a hands-on Kubernetes workshop for our backend team.',
        requester: mockPeople[1],
        skillNeeded: 'Kubernetes',
        category: 'devops',
        urgency: 'medium',
        duration: '1 day workshop',
        format: 'group',
        status: 'open',
        applicants: 2,
        createdAt: new Date().toISOString(),
        tags: ['Kubernetes', 'Workshop', 'Team Training']
      }
    ];

    const mockMentorshipPrograms: MentorshipProgram[] = [
      {
        id: 'mentor1',
        title: 'Frontend Development Bootcamp',
        description: '8-week program covering React, TypeScript, and modern frontend practices.',
        mentor: mockPeople[0],
        category: 'frontend',
        duration: '8 weeks',
        participants: 8,
        maxParticipants: 12,
        startDate: '2024-03-01',
        status: 'recruiting',
        rating: 4.7,
        level: 'intermediate',
        tags: ['React', 'TypeScript', 'Frontend']
      }
    ];

    const mockLearningSessions: LearningSession[] = [
      {
        id: 'session1',
        title: 'Introduction to Kubernetes',
        description: 'Learn the basics of container orchestration with Kubernetes.',
        host: mockPeople[1],
        category: 'devops',
        type: 'workshop',
        date: '2024-02-15T14:00:00Z',
        duration: 120,
        capacity: 20,
        registered: 15,
        location: 'virtual',
        level: 'beginner',
        tags: ['Kubernetes', 'Containers', 'DevOps'],
        materials: ['Slides', 'Code Examples', 'Practice Exercises']
      }
    ];

    setPeople(mockPeople);
    setSkillRequests(mockSkillRequests);
    setMentorshipPrograms(mockMentorshipPrograms);
    setLearningSessions(mockLearningSessions);
    setLoading(false);
  };

  const stats = {
    totalExperts: people.length,
    totalSkills: SKILL_CATEGORIES.reduce((sum, cat) => sum + cat.skills.length, 0),
    activeRequests: skillRequests.filter(r => r.status === 'open').length,
    sessionsThisWeek: learningSessions.length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Users className="w-16 h-16 animate-pulse text-blue-600 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Loading Skill Exchange
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Connecting you with internal experts...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-8 text-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center mb-2">
              <Users className="w-8 h-8 mr-3" />
              <h1 className="text-3xl font-bold">Skill Exchange</h1>
              <span className="ml-3 px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                Premium
              </span>
            </div>
            <p className="text-xl text-emerald-100">
              Internal marketplace for mentorship and skill sharing
            </p>
          </div>
          <button className="px-4 py-2 bg-white text-emerald-600 rounded-lg hover:bg-emerald-50 flex items-center transition-colors">
            <Plus className="w-5 h-5 mr-2" />
            Create Request
          </button>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center">
              <Award className="w-6 h-6 mr-3" />
              <div>
                <div className="text-2xl font-bold">{stats.totalExperts}</div>
                <div className="text-sm text-emerald-100">Experts</div>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center">
              <Lightbulb className="w-6 h-6 mr-3" />
              <div>
                <div className="text-2xl font-bold">{stats.totalSkills}</div>
                <div className="text-sm text-emerald-100">Skills</div>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center">
              <MessageSquare className="w-6 h-6 mr-3" />
              <div>
                <div className="text-2xl font-bold">{stats.activeRequests}</div>
                <div className="text-sm text-emerald-100">Active Requests</div>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center">
              <Calendar className="w-6 h-6 mr-3" />
              <div>
                <div className="text-2xl font-bold">{stats.sessionsThisWeek}</div>
                <div className="text-sm text-emerald-100">Sessions</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'marketplace', label: 'Skill Marketplace', icon: Users },
            { id: 'mentorship', label: 'Mentorship Programs', icon: BookOpen },
            { id: 'sessions', label: 'Learning Sessions', icon: Video },
            { id: 'profile', label: 'My Profile', icon: User }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-5 h-5 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search skills, people, or requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            >
              <option value="all">All Categories</option>
              {SKILL_CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            
            <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {activeTab === 'marketplace' && (
          <SkillMarketplace 
            people={people}
            skillRequests={skillRequests}
            categories={SKILL_CATEGORIES}
            searchQuery={searchQuery}
            selectedCategory={selectedCategory}
            onPersonSelect={setSelectedPerson}
          />
        )}
        
        {activeTab === 'mentorship' && (
          <MentorshipPrograms 
            programs={mentorshipPrograms}
            searchQuery={searchQuery}
          />
        )}
        
        {activeTab === 'sessions' && (
          <LearningSessions 
            sessions={learningSessions}
            searchQuery={searchQuery}
          />
        )}
        
        {activeTab === 'profile' && (
          <MyProfile 
            categories={SKILL_CATEGORIES}
          />
        )}
      </div>

      {/* Person Detail Modal */}
      {selectedPerson && (
        <PersonDetailModal
          person={selectedPerson}
          onClose={() => setSelectedPerson(null)}
        />
      )}
    </div>
  );
}

// Skill Marketplace Component
const SkillMarketplace = ({ people, skillRequests, categories, searchQuery, selectedCategory, onPersonSelect }: any) => {
  const [activeSubTab, setActiveSubTab] = useState<'experts' | 'requests'>('experts');
  
  return (
    <div className="space-y-6">
      {/* Sub Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveSubTab('experts')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === 'experts'
              ? 'border-emerald-500 text-emerald-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Find Experts ({people.length})
        </button>
        <button
          onClick={() => setActiveSubTab('requests')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === 'requests'
              ? 'border-emerald-500 text-emerald-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Skill Requests ({skillRequests.length})
        </button>
      </div>

      {activeSubTab === 'experts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {people.map((person: Person) => (
            <motion.div
              key={person.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => onPersonSelect(person)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center mr-4">
                    <span className="text-lg font-medium text-gray-700 dark:text-gray-300">
                      {person.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {person.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {person.title}
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Star className="w-4 h-4 text-yellow-500 mr-1" />
                  <span className="text-sm font-medium">{person.rating}</span>
                </div>
              </div>
              
              <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm line-clamp-2">
                {person.bio}
              </p>
              
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Teaching Skills
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {person.teachingSkills.slice(0, 3).map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 rounded text-xs font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                    {person.teachingSkills.length > 3 && (
                      <span className="px-2 py-1 text-gray-500 dark:text-gray-400 text-xs">
                        +{person.teachingSkills.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {person.location}
                  </span>
                  <span className="flex items-center">
                    <MessageSquare className="w-4 h-4 mr-1" />
                    {person.sessions} sessions
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {activeSubTab === 'requests' && (
        <div className="space-y-4">
          {skillRequests.map((request: SkillRequest) => (
            <div
              key={request.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {request.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-3">
                    {request.description}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {request.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    request.urgency === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                    request.urgency === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  }`}>
                    {request.urgency} priority
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {request.duration}
                  </span>
                  <span className="flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {request.format}
                  </span>
                  <span className="flex items-center">
                    <Eye className="w-4 h-4 mr-1" />
                    {request.applicants} applicants
                  </span>
                </div>
                <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">
                  Apply to Help
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Other tab components would be implemented similarly (simplified for space)
const MentorshipPrograms = ({ programs, searchQuery }: any) => (
  <div className="text-center py-12">
    <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
      Mentorship Programs
    </h3>
    <p className="text-gray-600 dark:text-gray-400">
      Join structured mentorship programs to accelerate your learning
    </p>
  </div>
);

const LearningSessions = ({ sessions, searchQuery }: any) => (
  <div className="text-center py-12">
    <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
      Learning Sessions
    </h3>
    <p className="text-gray-600 dark:text-gray-400">
      Attend workshops, talks, and interactive learning sessions
    </p>
  </div>
);

const MyProfile = ({ categories }: any) => (
  <div className="text-center py-12">
    <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
      My Profile
    </h3>
    <p className="text-gray-600 dark:text-gray-400">
      Manage your skills, availability, and mentoring preferences
    </p>
  </div>
);

// Person Detail Modal (simplified)
const PersonDetailModal = ({ person, onClose }: any) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden"
    >
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {person.name}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>
      <div className="p-6">
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-medium text-gray-700 dark:text-gray-300">
              {person.name.split(' ').map((n: string) => n[0]).join('')}
            </span>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {person.name}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">{person.title}</p>
          <div className="flex items-center justify-center mt-2">
            <Star className="w-4 h-4 text-yellow-500 mr-1" />
            <span className="text-sm font-medium">{person.rating}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
              ({person.reviews} reviews)
            </span>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Bio</h4>
            <p className="text-gray-600 dark:text-gray-400">{person.bio}</p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Teaching Skills</h4>
            <div className="flex flex-wrap gap-2">
              {person.teachingSkills.map((skill: string) => (
                <span
                  key={skill}
                  className="px-2 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 rounded text-sm"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
          
          <div className="flex gap-4">
            <button className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
              <Send className="w-4 h-4 mr-2 inline" />
              Send Message
            </button>
            <button className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              <Coffee className="w-4 h-4 mr-2 inline" />
              Request Session
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  </div>
);