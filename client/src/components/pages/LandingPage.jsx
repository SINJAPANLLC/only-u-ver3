import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
    const navigate = useNavigate();

    const handleGetStarted = () => {
        navigate('/signup');
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Fixed Header with Registration Button - Glass Morphism */}
            <div className="fixed top-0 right-0 left-0 z-50 glass-effect border-b border-white/30 shadow-3d">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center cursor-pointer hover-lift" onClick={() => navigate('/')}>
                        <img
                            src="/logo.webp"
                            alt="Only-U Logo"
                            className="h-8 w-auto object-contain sm:h-10"
                            data-testid="img-header-logo"
                        />
                    </div>

                    {/* Registration Button - 3D Neumorphic */}
                    <button
                        onClick={handleGetStarted}
                        className="btn-primary"
                        data-testid="button-register"
                    >
                        登録
                    </button>
                </div>
            </div>

            {/* Add padding to prevent content from being hidden behind fixed header */}
            <div className="pt-16">
                {/* Image 1: Hero with logo and tagline */}
                <div className="w-full">
                    <img 
                        src="/images/lp-1.png" 
                        alt="Only-U プライベートSNS - あなたの推しを育てる、特別な場所。"
                        className="w-full h-auto object-cover"
                        data-testid="img-lp-hero"
                    />
                </div>

            {/* Image 2: Expression - スマホに女性の写真 */}
            <div className="w-full">
                <img 
                    src="/images/lp-2.png" 
                    alt="好きなことを表現する。それだけで、推しの心に届く。"
                    className="w-full h-auto object-cover"
                    data-testid="img-lp-expression"
                />
            </div>

            {/* Image 3: You are the protagonist - あなたが主役 */}
            <div className="w-full cursor-pointer" onClick={handleGetStarted} data-testid="button-lp-signup">
                <img 
                    src="/images/lp-3.png" 
                    alt="ここでは、あなたが主役。Only-Uで、あなたの物語を始めよう。"
                    className="w-full h-auto object-cover"
                    data-testid="img-lp-protagonist"
                />
            </div>

            {/* Image 4: Monetization - 稼げるファンクラブ */}
            <div className="w-full">
                <img 
                    src="/images/lp-4.png" 
                    alt="稼げるファンクラブで、物語に彩りを"
                    className="w-full h-auto object-cover"
                    data-testid="img-lp-monetization"
                />
            </div>

            {/* Image 5: Recruitment Banner */}
            <div className="w-full">
                <img 
                    src="/images/lp-5.png" 
                    alt="RECRUIT - 運営・開発メンバー募集"
                    className="w-full h-auto object-cover"
                    data-testid="img-lp-recruit"
                />
            </div>

                {/* Footer */}
                <div className="w-full py-12 bg-gray-50">
                    <div className="max-w-4xl mx-auto px-4">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="flex flex-col items-center md:items-start">
                                <img 
                                    src="/logo.webp" 
                                    alt="Only-U Logo" 
                                    className="h-12 mb-4"
                                    data-testid="img-footer-logo"
                                />
                                <p className="text-sm text-gray-600" data-testid="text-copyright">
                                    © 2025 Only-U. All rights reserved.
                                </p>
                            </div>
                            <div className="flex flex-col md:flex-row gap-6 text-sm">
                                <button 
                                    onClick={() => navigate('/terms')}
                                    className="text-gray-600 hover:text-pink-600 transition-colors"
                                    data-testid="link-terms"
                                >
                                    利用規約
                                </button>
                                <button 
                                    onClick={() => navigate('/privacy')}
                                    className="text-gray-600 hover:text-pink-600 transition-colors"
                                    data-testid="link-privacy"
                                >
                                    プライバシーポリシー
                                </button>
                                <button 
                                    onClick={() => navigate('/legal')}
                                    className="text-gray-600 hover:text-pink-600 transition-colors"
                                    data-testid="link-legal"
                                >
                                    特定商取引法に基づく表記
                                </button>
                                <button 
                                    onClick={() => navigate('/guidelines')}
                                    className="text-gray-600 hover:text-pink-600 transition-colors"
                                    data-testid="link-guidelines"
                                >
                                    コンテンツガイドライン
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;
