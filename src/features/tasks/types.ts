import { type Models } from 'node-appwrite';

import type { Member } from '@/features/members/types';
import type { Project } from '@/features/projects/types';

export enum TaskStatus {
  BACKLOG = 'BACKLOG',
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export type Task = Models.Document & {
  name: string;
  status: TaskStatus;
  priority?: TaskPriority | null; // null on tasks created before this field existed
  assigneeId: string;
  projectId: string;
  workspaceId: string;
  position: number;
  dueDate: string;
  description?: string;
};

export type PopulatedTask = Task & {
  project: Project;
  assignee: Member;
};
