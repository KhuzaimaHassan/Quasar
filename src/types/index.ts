import React from 'react';

export type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
};

export type User = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
};
