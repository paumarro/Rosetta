import {
  // BookOpen,
  // Bot,
  // Frame,
  LifeBuoy,
  // Map,
  // PieChart,
  Send,
  PenTool,
  // Settings2,
  // SquareTerminal,
  Route,
} from 'lucide-react';

export const data = {
  user: {
    name: 'shadcn',
    email: 'm@example.com',
    avatar: '/avatars/shadcn.jpg',
  },
  navMain: [
    // {
    //   title: 'Learning Paths',
    //   url: '#',
    //   icon: Route,
    //   isActive: true,
    //   items: [
    //     {
    //       title: 'cariad',
    //       url: '#',
    //     },
    //     {
    //       title: 'e2e',
    //       url: '#',
    //     },
    //     {
    //       title: 'cicd',
    //       url: '#',
    //     },
    //   ],
    // },
    {
      title: 'Learning Paths',
      url: '/hub/learning-path',
      icon: Route,
    },
    // {
    //   title: 'Creators',
    //   url: '/creators',
    //   icon: PenTool,
    // },
    // {
    //   title: 'Models',
    //   url: '#',
    //   icon: Bot,
    //   items: [
    //     {
    //       title: 'Genesis',
    //       url: '#',
    //     },
    //     {
    //       title: 'Explorer',
    //       url: '#',
    //     },
    //     {
    //       title: 'Quantum',
    //       url: '#',
    //     },
    //   ],
    // },
    // {
    //   title: 'Documentation',
    //   url: '#',
    //   icon: BookOpen,
    //   items: [
    //     {
    //       title: 'Introduction',
    //       url: '#',
    //     },
    //     {
    //       title: 'Get Started',
    //       url: '#',
    //     },
    //     {
    //       title: 'Tutorials',
    //       url: '#',
    //     },
    //     {
    //       title: 'Changelog',
    //       url: '#',
    //     },
    //   ],
    // },
    // {
    //   title: 'Settings',
    //   url: '#',
    //   icon: Settings2,
    //   items: [
    //     {
    //       title: 'General',
    //       url: '#',
    //     },
    //     {
    //       title: 'Team',
    //       url: '#',
    //     },
    //     {
    //       title: 'Billing',
    //       url: '#',
    //     },
    //     {
    //       title: 'Limits',
    //       url: '#',
    //     },
    //   ],
    // },
  ],
  navSecondary: [
    {
      title: 'Support',
      url: '#',
      icon: LifeBuoy,
    },
    {
      title: 'Feedback',
      url: '#',
      icon: Send,
    },
  ],
  projects: [
    {
      name: 'Path Designer',
      url: '/creator/path-design',
      icon: PenTool,
    },
    // {
    //   name: 'Sales & Marketing',
    //   url: '#',
    //   icon: PieChart,
    // },
    // {
    //   name: 'Travel',
    //   url: '#',
    //   icon: Map,
    // },
  ],
};
