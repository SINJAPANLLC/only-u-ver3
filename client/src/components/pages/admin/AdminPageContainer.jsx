import React from 'react';
import { motion } from 'framer-motion';

/**
 * 管理画面ページ用の統一されたコンテナコンポーネント
 */
export function AdminPageContainer({ children, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`space-y-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}

/**
 * ページヘッダーコンポーネント
 */
export function AdminPageHeader({ title, description, actions, icon: Icon }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div className="flex items-start space-x-4">
        {Icon && (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <Icon className="w-6 h-6 text-white" />
          </div>
        )}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
          {description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center space-x-3 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

/**
 * 統計カードコンポーネント
 */
export function AdminStatsCard({ title, value, icon: Icon, trend, trendValue, color = 'pink' }) {
  const colorClasses = {
    pink: 'from-pink-500 to-pink-600',
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
  };

  return (
    <motion.div
      whileHover={{ y: -4, shadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center shadow-md`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {trend && (
          <div className={`text-sm font-medium ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend === 'up' ? '↑' : '↓'} {trendValue}
          </div>
        )}
      </div>
      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{title}</h3>
      <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </motion.div>
  );
}

/**
 * コンテンツカードコンポーネント
 */
export function AdminContentCard({ title, children, className = '', headerActions }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          {headerActions && <div className="flex items-center space-x-2">{headerActions}</div>}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

/**
 * テーブルコンテナコンポーネント
 */
export function AdminTableContainer({ children }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        {children}
      </div>
    </div>
  );
}

/**
 * 空の状態表示コンポーネント
 */
export function AdminEmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="text-center py-12">
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center mx-auto mb-4">
          <Icon className="w-8 h-8 text-pink-500" />
        </div>
      )}
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">{description}</p>
      )}
      {action && action}
    </div>
  );
}

/**
 * ローディング状態表示コンポーネント
 */
export function AdminLoadingState({ message = '読み込み中...' }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-pink-200 dark:border-pink-900/50"></div>
          <div className="absolute inset-0 rounded-full border-4 border-pink-500 dark:border-pink-400 border-t-transparent animate-spin"></div>
        </div>
        <p className="text-gray-600 dark:text-gray-400 font-medium">{message}</p>
      </div>
    </div>
  );
}
