import React, { useEffect, useState } from 'react'
import { Project } from '../../../../shared/types'
import { Button, TextField } from '../components'
import { InputTextArea } from '../components/InputTextArea/InputTextArea'
import { createProject, CreateProjectPayload, updateProject, UpdateProjectPayload } from '../features/projects'
import { useAppDispatch } from '../hooks/redux'

interface EditProjectProps {
  isOpen: boolean
  onClose: () => void
  editingProject?: Project | null
}

const EditProject: React.FC<EditProjectProps> = ({ isOpen, onClose, editingProject }) => {
  const dispatch = useAppDispatch()

  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectContext, setNewProjectContext] = useState('')
  const [newProjectSystemPrompt, setNewProjectSystemPrompt] = useState('')

  const isEditing = editingProject !== null

  useEffect(() => {
    if (editingProject) {
      setNewProjectName(editingProject.name)
      setNewProjectContext(editingProject.context || '')
      setNewProjectSystemPrompt(editingProject.system_prompt || '')
    } else if (isOpen) {
      // Only reset form when opening modal for creating new project
      resetForm()
    }
  }, [editingProject, isOpen])

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return

    const payload: CreateProjectPayload = {
      name: newProjectName.trim(),
      context: newProjectContext.trim() || undefined,
      system_prompt: newProjectSystemPrompt.trim() || undefined,
    }

    try {
      await dispatch(createProject(payload)).unwrap()
      resetForm()
      onClose()
    } catch (error) {
      console.error('Failed to create project:', error)
    }
  }

  const handleUpdateProject = async () => {
    if (!newProjectName.trim() || !editingProject) return

    const payload: UpdateProjectPayload = {
      id: editingProject.id,
      name: newProjectName.trim(),
      context: newProjectContext.trim() || undefined,
      system_prompt: newProjectSystemPrompt.trim() || undefined,
    }

    try {
      await dispatch(updateProject(payload)).unwrap()
      resetForm()
      onClose()
    } catch (error) {
      console.error('Failed to update project:', error)
    }
  }

  const resetForm = () => {
    setNewProjectName('')
    setNewProjectContext('')
    setNewProjectSystemPrompt('')
  }

  const handleCancel = () => {
    resetForm()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className='fixed inset-0 bg-neutral-300 dark:bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 text-lg'>
      <div className='bg-neutral-100 text-neutral-900 dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto'>
        <div className='p-6'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-2xl font-semibold dark:text-neutral-100'>
              {isEditing ? `Edit Project: ${editingProject?.name}` : 'Create New Project'}
            </h3>
            <button
              onClick={onClose}
              className='text-neutral-900 dark:text-neutral-200 hover:text-gray-600 dark:hover:text-gray-300'
            >
              <i className='bx bx-x text-2xl'></i>
            </button>
          </div>

          <div className='space-y-4'>
            <div>
              <label className='block text-lg text-neutral-900 font-medium mb-2 dark:text-neutral-200'>
                Project Name
              </label>
              <TextField
                placeholder='Enter project name...'
                value={newProjectName}
                onChange={setNewProjectName}
                className='text-lg'
              />
            </div>
            <div>
              <InputTextArea
                label='Context (Optional)'
                placeholder='Project context or description...'
                value={newProjectContext}
                onChange={setNewProjectContext}
                minRows={8}
                maxRows={12}
                width='w-full'
              />
            </div>
            <div>
              <InputTextArea
                label='System Prompt (Optional)'
                placeholder='System prompt for this project...'
                value={newProjectSystemPrompt}
                onChange={setNewProjectSystemPrompt}
                minRows={8}
                maxRows={12}
                width='w-full'
              />
            </div>
            <div className='flex gap-2 justify-end pt-4'>
              <Button variant='primary' size='medium' onClick={isEditing ? handleUpdateProject : handleCreateProject}>
                {isEditing ? 'Update Project' : 'Create Project'}
              </Button>
              <Button variant='secondary' size='medium' onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditProject
