import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem('pwa-install-dismissed');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        window.matchMedia('(display-mode: fullscreen)').matches ||
                        window.navigator.standalone === true;

    if (isDismissed || isStandalone) {
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    const handleAppInstalled = () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
      localStorage.setItem('pwa-install-dismissed', 'true');
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    setShowPrompt(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDeferredPrompt(null);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!showPrompt || !deferredPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-md"
        data-testid="pwa-install-prompt"
      >
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-pink-600 p-[2px] shadow-[0_8px_32px_-8px_rgba(236,72,153,0.5)]">
          <div className="relative rounded-2xl bg-white dark:bg-gray-900 p-4">
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              data-testid="button-dismiss-pwa"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3 pr-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                <Download className="w-6 h-6 text-white" />
              </div>

              <div className="flex-1">
                <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                  アプリをインストール
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  ホーム画面に追加して、フルスクリーンで快適に利用できます
                </p>

                <button
                  onClick={handleInstall}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg"
                  data-testid="button-install-pwa"
                >
                  インストール
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PWAInstallPrompt;
