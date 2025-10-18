'use client';

import Image from 'next/image';
import { useState } from 'react';

// Types based on the database schema
export interface TodoItem {
  id: string;
  list_id: string;
  name: string;
  description?: string;
  due_date?: string;
  status: 'not_started' | 'in_progress' | 'completed';
  done: boolean;
  media_url?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

interface ToDoCardProps {
  todo: TodoItem;
  onToggleComplete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: TodoItem['status']) => void;
}

export default function ToDoCard({ 
  todo, 
  onToggleComplete, 
  onEdit, 
  onDelete,
  onStatusChange 
}: ToDoCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = (status: TodoItem['status']) => {
    switch (status) {
      case 'not_started':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getPriorityFromDueDate = () => {
    if (!todo.due_date) return null;
    
    const dueDate = new Date(todo.due_date);
    const now = new Date();
    const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
    
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 1) return 'urgent';
    if (diffDays <= 3) return 'soon';
    return 'normal';
  };

  const priority = getPriorityFromDueDate();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`
      bg-white rounded-lg shadow-md border-l-4 p-4 mb-3 transition-all duration-200 hover:shadow-lg
      ${priority === 'overdue' ? 'border-l-red-500' : ''}
      ${priority === 'urgent' ? 'border-l-orange-500' : ''}
      ${priority === 'soon' ? 'border-l-yellow-500' : ''}
      ${priority === 'normal' || !priority ? 'border-l-blue-500' : ''}
      ${todo.done ? 'opacity-75' : ''}
    `}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          {/* Checkbox */}
          <button
            onClick={() => onToggleComplete?.(todo.id)}
            className={`
              w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 transition-colors
              ${todo.done 
                ? 'bg-green-500 border-green-500 text-white' 
                : 'border-gray-300 hover:border-green-400'
              }
            `}
          >
            {todo.done && (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className={`
              font-medium text-gray-900 mb-1 transition-all
              ${todo.done ? 'line-through text-gray-500' : ''}
            `}>
              {todo.name}
            </h3>
            
            {/* Status Badge */}
            <span className={`
              inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border
              ${getStatusColor(todo.status)}
            `}>
              {todo.status.replace('_', ' ').toUpperCase()}
            </span>

            {/* Due Date */}
            {todo.due_date && (
              <div className={`
                text-sm mt-2 font-medium
                ${priority === 'overdue' ? 'text-red-600' : ''}
                ${priority === 'urgent' ? 'text-orange-600' : ''}
                ${priority === 'soon' ? 'text-yellow-600' : ''}
                ${priority === 'normal' ? 'text-gray-600' : ''}
              `}>
                Due: {formatDate(todo.due_date)}
                {priority === 'overdue' && ' (Overdue)'}
              </div>
            )}

            {/* Description (expandable) */}
            {todo.description && (
              <div className="mt-2">
                <p className={`
                  text-gray-600 text-sm
                  ${!isExpanded ? 'line-clamp-2' : ''}
                `}>
                  {todo.description}
                </p>
                {todo.description.length > 100 && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-blue-500 hover:text-blue-600 text-sm font-medium mt-1"
                  >
                    {isExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            )}

            {/* Media Preview */}
            {todo.media_url && (
              <div className="mt-2">
                <Image 
                  src={todo.media_url} 
                  alt="Todo attachment" 
                  className="w-16 h-16 object-cover rounded border"
                  width={64}
                  height={64}
                />
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2 ml-4">
          {/* Status Dropdown */}
          <select
            value={todo.status}
            onChange={(e) => onStatusChange?.(todo.id, e.target.value as TodoItem['status'])}
            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white hover:bg-gray-50"
            disabled={todo.done}
          >
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>

          {/* Edit Button */}
          <button
            onClick={() => onEdit?.(todo.id)}
            className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
            title="Edit todo"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>

          {/* Delete Button */}
          <button
            onClick={() => onDelete?.(todo.id)}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            title="Delete todo"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>Created: {formatDate(todo.created_at)}</span>
        {todo.updated_at !== todo.created_at && (
          <span>Updated: {formatDate(todo.updated_at)}</span>
        )}
      </div>
    </div>
  );
}
