import React, { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../hooks/redux'
import { fetchTools, updateToolEnabled } from '../../features/chats/chatActions'
import { selectTools } from '../../features/chats/chatSelectors'
import { Button } from '../Button/button'

export const ToolsSettings: React.FC = () => {
  const dispatch = useAppDispatch()
  const tools = useAppSelector(selectTools)
  const [updatingTools, setUpdatingTools] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Fetch tools when component mounts
    dispatch(fetchTools())
  }, [dispatch])

  const handleToggle = async (toolName: string, currentEnabled: boolean) => {
    setUpdatingTools(prev => new Set(prev).add(toolName))

    try {
      await dispatch(updateToolEnabled({
        toolName,
        enabled: !currentEnabled
      })).unwrap()
    } catch (error) {
      console.error('Failed to update tool:', error)
    } finally {
      setUpdatingTools(prev => {
        const newSet = new Set(prev)
        newSet.delete(toolName)
        return newSet
      })
    }
  }

  if (!tools || tools.length === 0) {
    return (
      <div className="text-gray-500 dark:text-gray-400 text-sm">
        Loading tools...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-md font-medium text-stone-700 dark:text-stone-300 mb-3">
        Available Tools
      </h3>

      <div className="space-y-2">
        {tools.map(tool => (
          <div
            key={tool.name}
            className="flex items-center justify-between p-3 bg-white dark:bg-neutral-700 rounded-lg border border-gray-200 dark:border-gray-600"
          >
            <div className="flex-1">
              <div className="font-medium text-stone-800 dark:text-stone-200">
                {tool.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {tool.tool.description}
              </div>
            </div>

            <Button
              variant={tool.enabled ? 'primary' : 'secondary'}
              size="small"
              onClick={() => handleToggle(tool.name, tool.enabled)}
              disabled={updatingTools.has(tool.name)}
              className="ml-4 min-w-[80px]"
            >
              {updatingTools.has(tool.name)
                ? '...'
                : tool.enabled
                  ? 'Enabled'
                  : 'Disabled'
              }
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}