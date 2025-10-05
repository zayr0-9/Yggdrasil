import { createAsyncThunk } from '@reduxjs/toolkit'
import { Project } from '../../../../../shared/types'
import { apiCall } from '../../utils/api'

// Fetch all projects
export const fetchProjects = createAsyncThunk('projects/fetchProjects', async () => {
  const response = await apiCall('/projects', {
    method: 'GET',
  })
  return response as Project[]
})

// Fetch project by ID
export const fetchProjectById = createAsyncThunk('projects/fetchProjectById', async (projectId: number | string) => {
  const response = await apiCall(`/projects/${projectId}`, {
    method: 'GET',
  })
  return response as Project
})

// Create project
export interface CreateProjectPayload {
  name: string
  conversation_id?: number
  context?: string
  system_prompt?: string
}

export const createProject = createAsyncThunk('projects/createProject', async (payload: CreateProjectPayload) => {
  const response = await apiCall('/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return response as Project
})

// Update project
export interface UpdateProjectPayload {
  id: number | string
  name: string
  context?: string
  system_prompt?: string
}

export const updateProject = createAsyncThunk('projects/updateProject', async (payload: UpdateProjectPayload) => {
  const { id, ...updateData } = payload
  const response = await apiCall(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  })
  return response as Project
})

// Delete project
export const deleteProject = createAsyncThunk('projects/deleteProject', async (projectId: number | string) => {
  await apiCall(`/projects/${projectId}`, {
    method: 'DELETE',
  })
  return projectId
})
