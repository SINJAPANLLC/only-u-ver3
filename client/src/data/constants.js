export const featuredCreators = [
    {
        id: 1,
        name: 'Mika',
        image: '/api/placeholder/300/400',
        label: 'Currently attracting the most attention',
        badge: 'TOP 5',
        ranking: 'Updated on 8/16'
    },
    {
        id: 2,
        name: 'Yuki',
        image: '/api/placeholder/300/400',
        label: 'Super popular!',
        badge: 'TOP 5',
        ranking: 'Updated on 8/16'
    },
    {
        id: 3,
        name: 'Saki',
        image: '/api/placeholder/300/400',
        label: 'NEW',
        badge: 'Play',
        ranking: 'Updated on 8/16'
    }
];

export const notifications = [
    {
        id: 1,
        title: 'paymentRedirect',
        type: 'info'
    },
    {
        id: 2,
        title: 'termsUpdate',
        type: 'update'
    }
];

export const genreData = [
    { id: 1, nameKey: "amateur", count: 0, color: "from-pink-500 to-purple-600" },
    { id: 2, nameKey: "personalFilming", count: 0, color: "from-purple-500 to-indigo-600" },
    { id: 3, nameKey: "marriedWoman", count: 0, color: "from-red-500 to-pink-600" },
    { id: 4, nameKey: "largeBreasts", count: 0, color: "from-orange-500 to-red-600" },
    { id: 5, nameKey: "pervert", count: 0, color: "from-green-500 to-teal-600" },
    { id: 6, nameKey: "homeVideo", count: 0, color: "from-blue-500 to-purple-600" },
    { id: 7, nameKey: "beautifulWoman", count: 0, color: "from-pink-500 to-red-600" },
    { id: 8, nameKey: "beautifulBreasts", count: 0, color: "from-purple-500 to-pink-600" }
];

// ジャンル名のマッピング（nameKey → Firestoreのgenres配列に保存されている値）
export const genreNameMapping = {
    "amateur": "Amateur",
    "personalFilming": "Gonzo",
    "marriedWoman": "Married Woman",
    "largeBreasts": "Big Tits",
    "pervert": "Pervert",
    "homeVideo": "Home Video",
    "beautifulWoman": "Beautiful Woman",
    "beautifulBreasts": "Beautiful Breasts"
};


export const navItems = [
    { icon: 'Home', label: 'Home', id: 'home' },
    { icon: 'Star', label: 'Favorites', id: 'favorites' },
    { icon: 'Crown', label: 'Ranking', id: 'ranking' },
    { icon: 'MessageCircle', label: 'Messages', id: 'messages' },
    { icon: 'User', label: 'Account', id: 'account' }
];