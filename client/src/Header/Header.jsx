import React, { useState, useEffect } from 'react';
import { Bell, Search, Users, Moon, Sun, Globe, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GenderSelectionModal from './GenderModal';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

const Header = () => {
    const { t, i18n } = useTranslation();
    const { theme, toggleTheme } = useTheme();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedGender, setSelectedGender] = useState('General Adult');
    const [notificationCount, setNotificationCount] = useState(0);
    const [showLanguageMenu, setShowLanguageMenu] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showInstallButton, setShowInstallButton] = useState(false);
    const navigate = useNavigate();

    const handleGenderSelect = (gender) => setSelectedGender(gender.label);
    const handleConfirm = (gender) => console.log('Selected gender preference:', gender);

    // PWA Install Handler
    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallButton(true);
            console.log('📱 PWA install prompt available');
        };

        const handleAppInstalled = () => {
            setShowInstallButton(false);
            setDeferredPrompt(null);
            console.log('✅ PWA installed successfully');
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setShowInstallButton(false);
            console.log('✅ PWA already installed');
        } else {
            // 開発環境でも表示（本番環境では beforeinstallprompt で制御）
            setShowInstallButton(true);
            console.log('📱 PWA install button enabled (development mode)');
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) {
            console.log('⚠️ Install prompt not available');
            
            // ブラウザ別の手動インストール手順を表示
            const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
            const isAndroid = /Android/.test(navigator.userAgent);
            
            let message = '';
            if (isIOS) {
                message = 'iOSでホーム画面に追加するには：\n1. Safariで画面下の共有ボタン（□↑）をタップ\n2. 「ホーム画面に追加」を選択\n3. 「追加」をタップ';
            } else if (isAndroid) {
                message = 'Androidでホーム画面に追加するには：\n1. Chromeのメニュー（⋮）を開く\n2. 「ホーム画面に追加」を選択\n3. 「追加」をタップ';
            } else {
                message = 'ブラウザのメニューから「ホーム画面に追加」または「アプリをインストール」を選択してください。';
            }
            
            alert(message);
            return;
        }

        try {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            console.log(`📱 User response to install prompt: ${outcome}`);
            
            if (outcome === 'accepted') {
                setShowInstallButton(false);
            }
            
            setDeferredPrompt(null);
        } catch (error) {
            console.error('PWA install error:', error);
        }
    };

    // Languages you want to allow quick switching
    const languageOptions = [
        { code: 'en', label: 'English', flag: '🇺🇸' },
        { code: 'ja', label: '日本語', flag: '🇯🇵' },
    ];

    const changeLanguage = (langCode) => {
        i18n.changeLanguage(langCode);
        setShowLanguageMenu(false);
        console.log(`🌐 Language changed to: ${langCode}`);
    };

    const getCurrentLanguage = () => {
        const current = languageOptions.find(lang => lang.code === i18n.language);
        return current || languageOptions[1]; // デフォルトは日本語
    };

    return (
        <>
            <header className="bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 sticky top-0 z-40 transition-colors duration-200 safe-top">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <motion.div 
                        className="flex items-center cursor-pointer"
                        onClick={() => navigate('/')}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <motion.div
                            className="relative"
                            animate={{ 
                                y: [0, -3, 0],
                                rotate: [0, 2, 0, -2, 0]
                            }}
                            transition={{
                                duration: 4,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                        >
                            {/* グロウエフェクト */}
                            <motion.div
                                className="absolute inset-0 bg-gradient-to-br from-pink-400 to-pink-600 rounded-full blur-xl opacity-0"
                                animate={{
                                    opacity: [0, 0.3, 0],
                                    scale: [0.8, 1.2, 0.8]
                                }}
                                transition={{
                                    duration: 3,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                            />
                            <motion.img
                                src="/logo.webp"
                                alt="Fans Hub Logo"
                                className="h-8 w-auto object-contain sm:h-16 relative z-10"
                                whileHover={{ 
                                    rotate: [0, -5, 5, -5, 0],
                                    scale: 1.1
                                }}
                                transition={{
                                    rotate: { duration: 0.5 },
                                    scale: { duration: 0.2 }
                                }}
                            />
                        </motion.div>
                    </motion.div>

                    <div className="flex items-center space-x-2 sm:space-x-4">
                        <motion.button
                            whileHover={{ scale: 1.1, rotate: 15 }}
                            whileTap={{ scale: 0.95 }}
                            className="p-2.5 hover:bg-gradient-to-br hover:from-pink-50 hover:to-rose-50 dark:hover:from-pink-900/20 dark:hover:to-rose-900/20 rounded-full transition-all relative group"
                            onClick={() => navigate('/settings/notifications')}
                            data-testid="button-notifications"
                        >
                            <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-pink-500 dark:group-hover:text-pink-400 transition-colors" strokeWidth={2.5} />
                            {notificationCount > 0 && (
                                <motion.div 
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-gradient-to-br from-red-400 to-red-600 rounded-full shadow-md"
                                ></motion.div>
                            )}
                        </motion.button>

                        {showInstallButton && (
                            <motion.button
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                whileHover={{ scale: 1.1, y: -2 }}
                                whileTap={{ scale: 0.95 }}
                                className="p-2.5 hover:bg-gradient-to-br hover:from-pink-50 hover:to-rose-50 dark:hover:from-pink-900/20 dark:hover:to-rose-900/20 rounded-full transition-all group relative"
                                onClick={handleInstallClick}
                                data-testid="button-install-app"
                                title={i18n.language === 'ja' ? 'ホーム画面に追加' : 'Add to Home Screen'}
                            >
                                <Download className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-pink-500 dark:group-hover:text-pink-400 transition-colors" strokeWidth={2.5} />
                                <motion.div
                                    className="absolute -bottom-1 -right-1"
                                    animate={{ 
                                        scale: [1, 1.2, 1],
                                        opacity: [0.5, 1, 0.5]
                                    }}
                                    transition={{ 
                                        duration: 2, 
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                >
                                    <div className="w-2 h-2 bg-gradient-to-br from-green-400 to-green-600 rounded-full"></div>
                                </motion.div>
                            </motion.button>
                        )}

                        <div className="relative">
                            <motion.button
                                whileHover={{ scale: 1.1, rotate: 15 }}
                                whileTap={{ scale: 0.95 }}
                                className="p-2.5 hover:bg-gradient-to-br hover:from-pink-50 hover:to-rose-50 dark:hover:from-pink-900/20 dark:hover:to-rose-900/20 rounded-full transition-all group relative"
                                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                                data-testid="button-language"
                            >
                                <Globe className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-pink-500 dark:group-hover:text-pink-400 transition-colors" strokeWidth={2.5} />
                                <span className="absolute -bottom-1 -right-1 text-xs">{getCurrentLanguage().flag}</span>
                            </motion.button>

                            <AnimatePresence>
                                {showLanguageMenu && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                        transition={{ duration: 0.2 }}
                                        className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50"
                                    >
                                        {languageOptions.map((lang) => (
                                            <motion.button
                                                key={lang.code}
                                                whileHover={{ backgroundColor: 'rgba(236, 72, 153, 0.1)' }}
                                                className={`w-full px-4 py-3 flex items-center space-x-3 text-left transition-colors ${
                                                    i18n.language === lang.code 
                                                        ? 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400' 
                                                        : 'text-gray-700 dark:text-gray-300'
                                                }`}
                                                onClick={() => changeLanguage(lang.code)}
                                                data-testid={`lang-${lang.code}`}
                                            >
                                                <span className="text-2xl">{lang.flag}</span>
                                                <span className="font-medium">{lang.label}</span>
                                                {i18n.language === lang.code && (
                                                    <motion.span
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        className="ml-auto text-pink-600 dark:text-pink-400"
                                                    >
                                                        ✓
                                                    </motion.span>
                                                )}
                                            </motion.button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.1, rotate: theme === 'dark' ? -15 : 15 }}
                            whileTap={{ scale: 0.95 }}
                            className="p-2.5 hover:bg-gradient-to-br hover:from-pink-50 hover:to-rose-50 dark:hover:from-pink-900/20 dark:hover:to-rose-900/20 rounded-full transition-all group"
                            onClick={toggleTheme}
                            data-testid="button-theme-toggle"
                        >
                            <motion.div
                                initial={false}
                                animate={{ 
                                    rotate: theme === 'dark' ? 360 : 0,
                                    scale: [0.8, 1.1, 1]
                                }}
                                transition={{ duration: 0.5 }}
                            >
                                {theme === 'dark' ? (
                                    <Sun className="w-5 h-5 text-amber-500 group-hover:text-amber-400 transition-colors" strokeWidth={2.5} />
                                ) : (
                                    <Moon className="w-5 h-5 text-gray-600 group-hover:text-pink-500 transition-colors" strokeWidth={2.5} />
                                )}
                            </motion.div>
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            className="p-2.5 hover:bg-gradient-to-br hover:from-pink-50 hover:to-rose-50 dark:hover:from-pink-900/20 dark:hover:to-rose-900/20 rounded-full transition-all group"
                            onClick={() => navigate('/search')}
                            data-testid="button-search"
                        >
                            <Search className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-pink-500 dark:group-hover:text-pink-400 transition-colors" strokeWidth={2.5} />
                        </motion.button>
                    </div>
                </div>
            </header>

            {/* Gender Selection Modal */}
            <GenderSelectionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                selectedGender={selectedGender}
                onGenderSelect={handleGenderSelect}
                onConfirm={handleConfirm}
            />
        </>
    );
};

export default Header;
