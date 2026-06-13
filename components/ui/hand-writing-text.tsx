"use client";

import type { ReactNode } from "react";
import { motion, type Variants } from "framer-motion";
interface HandWrittenTitleProps {
    title?: string;
    subtitle?: string;
    icon?: ReactNode;
}

function HandWrittenTitle({
    title = "Hand Written",
    subtitle = "Optional subtitle",
    icon,
}: HandWrittenTitleProps) {
    const draw: Variants = {
        hidden: { pathLength: 0, opacity: 0 },
        visible: {
            pathLength: 1,
            opacity: 1,
            transition: {
                pathLength: { duration: 2.5, ease: [0.43, 0.13, 0.23, 0.96] },
                opacity: { duration: 0.5 },
            },
        },
    };

    return (
        <div className="relative w-full max-w-4xl mx-auto py-24">
            <div className="absolute inset-0">
                <motion.svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 1200 600"
                    initial="hidden"
                    animate="visible"
                    className="w-full h-full"
                >
                    <title>KokonutUI</title>
                    <motion.path
                        d="M 950 90
                           C 1250 300, 1050 480, 600 520
                           C 250 520, 150 480, 150 300
                           C 150 120, 350 80, 600 80
                           C 850 80, 950 180, 950 180"
                        fill="none"
                        strokeWidth="12"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        variants={draw}
                        className="text-foreground opacity-90"
                    />
                </motion.svg>
            </div>
            <div className="relative text-center z-10 flex flex-col items-center justify-center">
                {icon && (
                    <motion.div
                        className="mb-3 text-foreground"
                        initial={{ opacity: 0, y: 12, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: 0.3, duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
                    >
                        {icon}
                    </motion.div>
                )}
                <motion.h1
                    className="text-4xl md:text-6xl text-foreground tracking-tighter flex items-center gap-2"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                >
                    {title}
                </motion.h1>
                {subtitle && (
                    <motion.p
                        className="text-xl text-muted-foreground"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1, duration: 0.8 }}
                    >
                        {subtitle}
                    </motion.p>
                )}
            </div>
        </div>
    );
}


export { HandWrittenTitle }
