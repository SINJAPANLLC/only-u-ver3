import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';
import logger from './logger';

const reportWebVitals = (onPerfEntry) => {
    if (onPerfEntry && onPerfEntry instanceof Function) {
        onCLS(onPerfEntry);
        onFCP(onPerfEntry);
        onINP(onPerfEntry);
        onLCP(onPerfEntry);
        onTTFB(onPerfEntry);
    }
};

export const initWebVitals = () => {
    reportWebVitals((metric) => {
        const value = Math.round(
            metric.name === 'CLS' ? metric.value * 1000 : metric.value
        );
        
        logger.log(`[Web Vitals] ${metric.name}:`, {
            value: `${value}${metric.name === 'CLS' ? ' (×1000)' : 'ms'}`,
            rating: metric.rating,
            id: metric.id
        });
        
        if (metric.name === 'LCP' && metric.value > 2500) {
            logger.warn(`⚠️ Slow LCP detected: ${value}ms (target: <2500ms)`);
        }
        
        if (metric.name === 'INP' && metric.value > 200) {
            logger.warn(`⚠️ Slow INP detected: ${value}ms (target: <200ms)`);
        }
        
        if (metric.name === 'CLS' && metric.value > 0.1) {
            logger.warn(`⚠️ High CLS detected: ${metric.value} (target: <0.1)`);
        }
    });
};

export default reportWebVitals;
