import React, { useEffect, useState } from 'react'
import { fetchTools, updateToolEnabled } from '../../features/chats/chatActions'
import { selectTools } from '../../features/chats/chatSelectors'
import { useAppDispatch, useAppSelector } from '../../hooks/redux'
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
      await dispatch(
        updateToolEnabled({
          toolName,
          enabled: !currentEnabled,
        })
      ).unwrap()
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

  const handleValkyrieToggle = async () => {
    const enableAll = !someToolsEnabled // If no tools enabled, enable all; if some/all enabled, disable all
    const toolsToUpdate = tools.filter(tool => tool.enabled !== enableAll)

    // Mark all tools as updating
    setUpdatingTools(new Set(toolsToUpdate.map(tool => tool.name)))

    try {
      // Update all tools in parallel
      await Promise.all(
        toolsToUpdate.map(tool =>
          dispatch(
            updateToolEnabled({
              toolName: tool.name,
              enabled: enableAll,
            })
          ).unwrap()
        )
      )
    } catch (error) {
      console.error('Failed to update tools:', error)
    } finally {
      // Clear all updating states
      setUpdatingTools(new Set())
    }
  }

  const someToolsEnabled = tools.some(tool => tool.enabled)
  const isUpdatingAny = updatingTools.size > 0
  const valkyrieActive = someToolsEnabled

  if (!tools || tools.length === 0) {
    return <div className='text-gray-500 dark:text-gray-400 text-sm'>Loading tools...</div>
  }

  return (
    <div className='space-y-4'>
      {/* Valkyrie Master Toggle */}
      <div
        className={`${
          valkyrieActive
            ? 'bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 border-purple-200 dark:border-purple-700'
            : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-500'
        } rounded-lg p-4 border`}
      >
        <div className='flex items-center justify-between'>
          <div>
            <h3
              className={`text-lg font-semibold flex items-center ${
                valkyrieActive ? 'text-purple-800 dark:text-purple-300' : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {valkyrieActive ? '⚡' : '💤'} Valkyrie
            </h3>
            <p
              className={`text-sm mt-1 ${
                valkyrieActive ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-500'
              }`}
            >
              {valkyrieActive ? 'AI tools are active' : 'AI tools are disabled'}
            </p>
          </div>
          <Button
            variant={valkyrieActive ? 'primary' : 'secondary'}
            size='small'
            onClick={handleValkyrieToggle}
            disabled={isUpdatingAny}
            className='min-w-[40px] flex items-center justify-center'
          >
            {isUpdatingAny ? (
              '...'
            ) : (
              <i
                className={`bx bx-power-off text-lg active:scale-95 transition-transform duration-300 ${
                  valkyrieActive ? '' : 'rotate-180'
                }`}
              ></i>
            )}
          </Button>
        </div>
      </div>

      {/* Individual Tools - Only show when Valkyrie is active */}
      <div
        className={`overflow-hidden transition-all duration-500 ease-in-out ${
          valkyrieActive ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className='space-y-4'>
          <h3 className='text-md font-medium text-stone-700 dark:text-stone-300 mb-3'>Individual Tools</h3>

          <div className='space-y-2'>
            {tools.map(tool => (
              <div
                key={tool.name}
                className='flex items-center justify-between p-3 bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-gray-600'
              >
                <div className='flex-1'>
                  <div className='font-medium text-stone-800 dark:text-stone-200'>
                    {tool.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </div>
                  <div className='text-sm text-gray-600 dark:text-gray-400 mt-1'>{tool.tool.description}</div>
                </div>

                <Button
                  variant={tool.enabled ? 'primary' : 'secondary'}
                  size='small'
                  onClick={() => handleToggle(tool.name, tool.enabled)}
                  disabled={updatingTools.has(tool.name)}
                  className='ml-4 min-w-[40px] flex items-center justify-center'
                >
                  {updatingTools.has(tool.name) ? (
                    '...'
                  ) : tool.enabled ? (
                    <i className='bx bx-check text-lg active:scale-95'></i>
                  ) : (
                    <i className='bx bx-x text-lg active:scale-95'></i>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
