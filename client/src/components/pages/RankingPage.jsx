import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';

const RankingPage = () => {
    const { t } = useTranslation();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef(null);
    const user = auth.currentUser;

    // メッセージをリアルタイムで取得
    useEffect(() => {
        const q = query(
            collection(db, 'liveChat'),
            orderBy('timestamp', 'desc'),
            limit(100)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = [];
            snapshot.forEach((doc) => {
                msgs.push({ id: doc.id, ...doc.data() });
            });
            setMessages(msgs.reverse());
        });

        return () => unsubscribe();
    }, []);

    // 新しいメッセージが来たら自動スクロール
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // メッセージ送信
    const handleSendMessage = async (e) => {
        e.preventDefault();
        
        if (!newMessage.trim() || !user) return;
        
        setIsSending(true);
        
        try {
            await addDoc(collection(db, 'liveChat'), {
                text: newMessage.trim(),
                userId: user.uid,
                userName: user.displayName || 'Anonymous',
                userPhoto: user.photoURL || '',
                timestamp: serverTimestamp()
            });
            
            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black pb-20 flex flex-col">
            {/* ヘッダー */}
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 shadow-sm">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-center space-x-3">
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="w-3 h-3 bg-red-500 rounded-full"
                        />
                        <Radio className="w-6 h-6 text-pink-500" />
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent">
                            {t('navigation.ranking')}
                        </h1>
                    </div>
                    <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                        リアルタイムで会話しよう
                    </p>
                </div>
            </div>

            {/* チャットメッセージエリア */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ height: 'calc(100vh - 240px)' }}>
                <AnimatePresence>
                    {messages.map((message, index) => {
                        const isOwnMessage = message.userId === user?.uid;
                        
                        return (
                            <motion.div
                                key={message.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ delay: index * 0.02 }}
                                className={`flex items-start space-x-3 ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}
                                data-testid={`message-${message.id}`}
                            >
                                {/* ユーザーアイコン */}
                                <div className="flex-shrink-0">
                                    {message.userPhoto ? (
                                        <img
                                            src={message.userPhoto}
                                            alt={message.userName}
                                            className="w-10 h-10 rounded-full object-cover border-2 border-pink-500"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center text-white font-bold">
                                            {message.userName?.[0]?.toUpperCase() || 'A'}
                                        </div>
                                    )}
                                </div>

                                {/* メッセージバブル */}
                                <div className={`flex-1 max-w-xs md:max-w-md ${isOwnMessage ? 'text-right' : ''}`}>
                                    <div className={`text-xs text-gray-500 dark:text-gray-400 mb-1 ${isOwnMessage ? 'text-right' : ''}`}>
                                        {message.userName}
                                    </div>
                                    <div
                                        className={`inline-block px-4 py-2 rounded-2xl ${
                                            isOwnMessage
                                                ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white'
                                                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-white border border-gray-200 dark:border-gray-700'
                                        }`}
                                    >
                                        <p className="text-sm break-words">{message.text}</p>
                                    </div>
                                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                        {message.timestamp?.toDate?.()?.toLocaleTimeString('ja-JP', { 
                                            hour: '2-digit', 
                                            minute: '2-digit' 
                                        })}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </div>

            {/* メッセージ入力エリア */}
            <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-4 py-4 sticky bottom-16 z-40">
                <form onSubmit={handleSendMessage} className="max-w-6xl mx-auto">
                    <div className="flex items-center space-x-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={user ? "メッセージを入力..." : "ログインしてメッセージを送信"}
                            disabled={!user || isSending}
                            className="flex-1 px-4 py-3 rounded-full border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent disabled:opacity-50"
                            data-testid="input-message"
                        />
                        <motion.button
                            type="submit"
                            disabled={!user || !newMessage.trim() || isSending}
                            whileTap={{ scale: 0.95 }}
                            className="p-3 rounded-full bg-gradient-to-r from-pink-500 to-pink-600 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-shadow"
                            data-testid="button-send"
                        >
                            <Send className="w-5 h-5" />
                        </motion.button>
                    </div>
                </form>
            </div>

            {/* ボトムナビゲーション */}
            <BottomNavigationWithCreator active="ranking" />
        </div>
    );
};

export default RankingPage;
