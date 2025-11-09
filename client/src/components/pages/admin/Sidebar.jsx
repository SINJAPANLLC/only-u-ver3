import React from "react";
import { NavLink } from "react-router-dom";
import { Users, FileText, BarChart3, DollarSign, Shield, LogOut, Mail, Bell, Crown, Coins, Video, Heart, MessageSquare, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useAuth } from "../../../context/AuthContext";

export default function Sidebar({ open, setOpen, onLogout }) {
  const { t } = useTranslation();
  const { currentUser } = useAuth();

  const navItems = [
    { name: "ダッシュボード", path: "/admin", icon: BarChart3 },
    { name: "ユーザー管理", path: "/admin/users", icon: Users },
    { name: "クリエイター管理", path: "/admin/creators", icon: Users },
    { name: "投稿管理", path: "/admin/posts", icon: FileText },
    { name: "ライブ配信管理", path: "/admin/live-streams", icon: Video },
    { name: "マッチング管理", path: "/admin/matches", icon: Heart },
    { name: "メッセージ管理", path: "/admin/messages", icon: MessageSquare },
    { name: "収益管理", path: "/admin/sales", icon: DollarSign },
    { name: "振込申請管理", path: "/admin/transfer-requests", icon: Coins },
    { name: "KYC/本人確認", path: "/admin/verification", icon: Shield },
    { name: "レポート管理", path: "/admin/reports", icon: FileText },
    { name: "通知管理", path: "/admin/notifications", icon: Bell },
    { name: "分析", path: "/admin/analytics", icon: TrendingUp },
  ];

  return (
    <>
      {/* Overlay on mobile */}
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed z-50 inset-y-0 left-0 w-64 bg-white border-r border-pink-100 shadow-lg transform md:translate-x-0 transition-transform duration-300 ease-in-out md:relative
        ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 py-5 border-b border-pink-100 bg-gradient-to-r from-pink-50 to-white">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center shadow-md">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">OnlyU</h2>
                <p className="text-xs text-gray-500">管理システム</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map(({ name, path, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/admin"}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 text-sm rounded-xl transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-md"
                      : "text-gray-700 hover:bg-pink-50 hover:text-pink-600"
                  }`
                }
                onClick={() => setOpen(false)}
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                    <span className="font-medium">{name}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Bottom section */}
          <div className="p-4 border-t border-pink-100 bg-gradient-to-r from-pink-50 to-white">
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center px-4 py-3 text-sm text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg mb-4"
              data-testid="button-admin-logout"
            >
              <LogOut className="w-5 h-5 mr-2" />
              <span className="font-medium">ログアウト</span>
            </button>
            
            <div className="text-center">
              <p className="text-xs text-gray-500 font-medium">© 2025 SIN JAPAN LLC</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
