import {useEffect, useRef, useState} from 'react';
import Phaser from 'phaser';
import {gameConfig} from '../../game/config';
import {EventBus} from '../../game/EventBus';
import {EventNames} from '../../game/constants';
import {WORLD_PX, DEFAULT_ZONES} from '../../game/config/worldConfig';
import FantasyBorderFrame from '../fantasy-border-frame/FantasyBorderFrame';
import ProgressPopup from '../popups/ProgressPopup';
import celticBgUrl from '../../../sprites/border/CelticBackground.png';

const ARMY_PANEL_WIDTH = 440;
// Math.min(tileDimensions.width, tileDimensions.height) for default FantasyBorderFrame dims (50×180)
const CORNER_SIZE = 50;
// Math.min(20, 70) for thin-frame variant used in PopupWrapper
const THIN_CORNER = 20;

export function BattleLayout() {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Phaser.Game | null>(null);
    const [loading, setLoading] = useState(true);

    // Layout is stable for the session — read once at component definition time.
    const w = window.innerWidth;
    const h = window.innerHeight;

    useEffect(() => {
        if (!containerRef.current || gameRef.current) return;

        gameRef.current = new Phaser.Game({
            ...gameConfig,
            parent: containerRef.current,
        });

        const onComplete = () => setLoading(false);
        EventBus.on(EventNames.PRELOAD_COMPLETE, onComplete);

        return () => {
            EventBus.off(EventNames.PRELOAD_COMPLETE, onComplete);
            gameRef.current?.destroy(true);
            gameRef.current = null;
        };
    }, []);

    // ── Zone frame geometry ──────────────────────────────────────────────────────
    // Phaser canvas occupies the content area of the right panel.
    // With the one-border overlap, the right panel's content starts at x=ARMY_PANEL_WIDTH.
    const canvasW = w - ARMY_PANEL_WIDTH - CORNER_SIZE;
    const canvasH = h - 2 * CORNER_SIZE;

    // Replicate DeployScene.fitCameraToWorld() to find where the world sits on screen.
    const worldZoom = Math.min(canvasW / WORLD_PX.width, canvasH / WORLD_PX.height);
    const worldScreenW = WORLD_PX.width * worldZoom;
    const worldScreenH = WORLD_PX.height * worldZoom;
    const worldLeft = ARMY_PANEL_WIDTH + (canvasW - worldScreenW) / 2;
    const worldTop = CORNER_SIZE + (canvasH - worldScreenH) / 2;

    const {attacker, neutral} = DEFAULT_ZONES;
    // Each zone after the first is shifted up by THIN_CORNER so its top border overlaps
    // (and hides) the previous zone's bottom border — one visible seam, not two.
    // zIndex increments so each subsequent frame renders on top at the shared seam.
    // accessible - should be filled based on user side: user attacker - accessible zone 1, defender - accessible zone 3.
    const y0 = worldTop;
    const y1 = worldTop + worldScreenH * attacker;
    const y2 = worldTop + worldScreenH * (attacker + neutral);
    const zoneFrames = [
        {y: y0, h: worldScreenH * attacker, zIndex: 99, accessible: false},
        {y: y1 - THIN_CORNER, h: worldScreenH * neutral + THIN_CORNER, zIndex: 99, accessible: false},
        {y: y2 - THIN_CORNER, h: worldScreenH * (1 - attacker - neutral) + THIN_CORNER, zIndex: 99, accessible: true},
    ];

    // ── ProgressPopup centre ─────────────────────────────────────────────────────
    const popupX = w / 2 - 200;
    const popupY = h / 2 - 100;

    return (
        <FantasyBorderFrame
            screenPosition={{x: 0, y: 0}}
            frameSize={{width: window.innerWidth, height: window.innerHeight}}
            accessible={true}
            zIndex={100}
        >
            {/* ── Full-screen Celtic texture background (behind all frames) ─────── */}
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundImage: `url(${celticBgUrl})`,
                    backgroundRepeat: 'repeat',
                    zIndex: 0,
                }}
            />

            {/* ── Left: army panel ──────────────────────────────────────────────── */}
            <div style={{color: '#c8a87a', padding: '12px 8px', fontSize: 14, width: ARMY_PANEL_WIDTH, height: h}}>
                Army Panel
                <br/>
                <span style={{opacity: 0.5, fontSize: 12, color: "black"}}>(implemented in Step 2)</span>
            </div>

            {/* ── Right: battlefield ────────────────────────────────────────────── */}
            {/* ── Thin zone frames (visible once Phaser has rendered the zones) ─── */}
            {!loading && zoneFrames.map((zone, i) => (
                <FantasyBorderFrame
                    key={i}
                    screenPosition={{x: worldLeft, y: zone.y}}
                    frameSize={{width: worldScreenW, height: zone.h}}
                    tileDimensions={{width: 20, height: 70}}
                    accessible={zone.accessible}
                    zIndex={zone.zIndex}
                >
                    {null}
                </FantasyBorderFrame>
            ))}

            {/* ── Loading overlay ───────────────────────────────────────────────── */}
            {loading && (
                <ProgressPopup
                    screenPosition={{x: popupX, y: popupY}}
                    message="Loading battle assets…"
                />
            )}
        </FantasyBorderFrame>
    );
}
