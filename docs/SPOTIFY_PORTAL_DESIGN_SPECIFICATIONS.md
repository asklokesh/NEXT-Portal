# Spotify Portal Design Specifications

## Visual Design System

### Color Palette
- Primary: Spotify Green (#1DB954)
- Secondary: Dark Gray (#191414) 
- Accent: Teal/Mint (#9BF0E1) - as seen in Portal marketing
- Background: Dark theme with subtle gradients
- Text: High contrast white/light gray on dark backgrounds

### Typography
- Font Family: System fonts with fallbacks (Inter, Segoe UI, system-ui)
- Font Weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- Scale: 12px, 14px, 16px, 18px, 20px, 24px, 32px, 48px

### Spacing System
- Base unit: 4px
- Scale: 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 64px

### Border Radius
- Small: 4px
- Medium: 8px
- Large: 12px
- XL: 16px

## Component Design Patterns

### Cards
- Dark background with subtle borders
- Rounded corners (8px-12px)
- Subtle shadows and gradients
- Hover states with slight elevation
- Consistent padding (16px-24px)

### Navigation
- Collapsible sidebar with clean icons
- Dark theme with Spotify green accents
- Smooth animations and transitions
- Breadcrumb navigation
- Search-first approach

### Buttons
- Primary: Spotify green background
- Secondary: Transparent with borders
- Ghost: Text-only with hover states
- Consistent height (32px, 40px, 48px)
- Rounded corners (6px)

### Forms
- Dark theme inputs with subtle borders
- Focus states with Spotify green accents
- Consistent validation patterns
- Helpful placeholder text
- Error states with clear messaging

## Layout Principles

### Grid System
- 12-column responsive grid
- Breakpoints: 640px, 768px, 1024px, 1280px, 1536px
- Consistent gutters (16px mobile, 24px desktop)

### Content Areas
- Maximum content width: 1200px
- Sidebar: 256px-280px
- Header height: 64px
- Consistent margins and padding

### Responsive Design
- Mobile-first approach
- Touch-friendly interfaces
- Optimized for all screen sizes
- Progressive enhancement

## Interaction Patterns

### Microinteractions
- Smooth hover states (200ms ease)
- Loading states with subtle animations
- Feedback for user actions
- Progressive disclosure

### Navigation Flow
- Clear information hierarchy
- Logical user journeys
- Minimal clicks to complete tasks
- Consistent back/forward patterns

## Accessibility Standards

### WCAG 2.1 AA Compliance
- Color contrast ratios: 4.5:1 for normal text, 3:1 for large text
- Keyboard navigation support
- Screen reader compatibility
- Focus indicators
- Alternative text for images

### Semantic HTML
- Proper heading hierarchy
- ARIA labels and roles
- Form labels and descriptions
- Skip links for navigation

## Brand Alignment

### Spotify Portal Specific Elements
- "Portal" branding throughout
- Backstage terminology and concepts
- GitHub-centric workflow language
- Developer-focused messaging
- Enterprise-grade appearance

### Visual Consistency
- Consistent iconography (Lucide React icons)
- Unified spacing and typography
- Coherent color application
- Professional aesthetic

## Performance Considerations

### Loading States
- Skeleton screens for content areas
- Progressive image loading
- Chunked JavaScript delivery
- Optimized font loading

### Animation Performance
- GPU-accelerated animations
- 60fps smooth interactions
- Reduced motion preferences
- Lightweight transitions