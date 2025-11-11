import { useEffect, useRef, useState } from 'react';

export const useIntersectionObserver = (options = {}) => {
    const [isIntersecting, setIsIntersecting] = useState(false);
    const [hasIntersected, setHasIntersected] = useState(false);
    const targetRef = useRef(null);

    useEffect(() => {
        const target = targetRef.current;
        if (!target) return;

        const defaultOptions = {
            root: null,
            rootMargin: '50px',
            threshold: 0.01,
            ...options
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                setIsIntersecting(entry.isIntersecting);
                
                if (entry.isIntersecting && !hasIntersected) {
                    setHasIntersected(true);
                }
            });
        }, defaultOptions);

        observer.observe(target);

        return () => {
            if (target) {
                observer.unobserve(target);
            }
        };
    }, [options.root, options.rootMargin, options.threshold, hasIntersected]);

    return { targetRef, isIntersecting, hasIntersected };
};
