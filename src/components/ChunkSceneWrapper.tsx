"use client";
import { useEffect, useRef } from "react";

type WasdKeys = {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
};

export default function ChunkSceneWrapper({ topBarHeight = 32 }: { topBarHeight?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // we'll assign this after Phaser loads; cleanup uses this function
    let destroyGame: (() => void) | null = null;

    (async () => {
      const Phaser = await import("phaser");
      const { Scale, Input } = Phaser;

      // ---------- CONFIG ----------
      const TILE = 2;                 // 2px tiles
      const VIEW_TILES_W = 240;
      const VIEW_TILES_H = 135;
      const MAP_W = VIEW_TILES_W;
      const MAP_H = VIEW_TILES_H;

      const HERO_FRAME_W = 384;   
      const HERO_FRAME_H = 1024;  
      const PLAYER_SCALE  = 0.06;       
      const MOVE_SPEED = 60;          
      const CAMERA_ZOOM = 4;          

      // RNG
      const seeded = (seed: string) => {
        let h = 2166136261 ^ seed.length;
        for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h += (h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24); }
        h >>>= 0;
        return () => { h += 0x6D2B79F5; h = Math.imul(h ^ (h>>>15), 1|h); h ^= h + Math.imul(h ^ (h>>>7), 61|h); return ((h ^ (h>>>14))>>>0)/4294967296; };
      };

      class ChunkScene extends Phaser.Scene {
        private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
        private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
        private wasd!: WasdKeys;

        preload() {
          
       this.load.spritesheet("hero", "/sprites/hero.png", {
  frameWidth: HERO_FRAME_W,
  frameHeight: HERO_FRAME_H,
});

          // 2) fallback micro tiles (generated)
          const g = this.add.graphics({ x: 0, y: 0 }).setVisible(false);
          const make = (key: string, draw: (gg: Phaser.GameObjects.Graphics) => void, w = TILE, h = TILE) => {
            g.clear(); draw(g); g.generateTexture(key, w, h);
          };
          make("grass",  gr => gr.fillStyle(0x3aa655).fillRect(0,0,TILE,TILE));
          make("grass2", gr => gr.fillStyle(0x2f8a47).fillRect(0,0,TILE,TILE));
          make("sand",   gr => gr.fillStyle(0xd2b48c).fillRect(0,0,TILE,TILE));
          make("water",  gr => gr.fillStyle(0x2a6dbb).fillRect(0,0,TILE,TILE));
          make("rock",   gr => gr.fillStyle(0x6d6d6d).fillRect(0,0,TILE,TILE));
          make("cliff",  gr => { gr.fillStyle(0x4b4b4b).fillRect(0,0,TILE,TILE); gr.fillStyle(0x2f2f2f).fillRect(0,0,TILE,Math.max(1,Math.floor(TILE/2))); });
        }

        create() {
          const worldW = MAP_W * TILE;
          const worldH = MAP_H * TILE;
          this.physics.world.setBounds(0, 0, worldW, worldH);

          const rand = seeded("mirage_demo_seed");

          const tileKeyAt = (x: number, y: number): "water"|"sand"|"rock"|"grass"|"grass2" => {
            const nx = (x - MAP_W / 2) / MAP_W;
            const ny = (y - MAP_H / 2) / MAP_H;
            const d = Math.hypot(nx * 1.2, ny * 0.9);
            if (d > 0.52) return "water";
            if (d > 0.46) return "sand";
            if (rand() < 0.05) return "rock";
            return rand() < 0.15 ? "grass2" : "grass";
          };

          // draw terrain as grid-aligned images
          for (let y = 0; y < MAP_H; y++) {
            for (let x = 0; x < MAP_W; x++) {
              this.add.image(x*TILE, y*TILE, tileKeyAt(x,y)).setOrigin(0);
            }
          }

          // build cliff mask (fake elevation → blockers)
          const cliffMask: boolean[][] = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(false));
          for (let y = 0; y < MAP_H; y++) {
            for (let x = 0; x < MAP_W; x++) {
              const here = tileKeyAt(x, y);
              if (here === "water" || here === "sand") {
                const up   = y > 0 ? tileKeyAt(x, y-1) : "water";
                const left = x > 0 ? tileKeyAt(x-1, y) : "water";
                const upLand   = (up   === "grass" || up === "grass2" || up === "rock");
                const leftLand = (left === "grass" || left === "grass2" || left === "rock");
                if (upLand || leftLand) {
                  this.add.image(x*TILE, y*TILE, "cliff").setOrigin(0).setDepth(2);
                  cliffMask[y][x] = true;
                }
              }
            }
          }

          // colliders: create static images so we get typed StaticBody
          const cliffBodies: Phaser.Types.Physics.Arcade.ImageWithStaticBody[] = [];
          for (let y = 0; y < MAP_H; y++) {
            for (let x = 0; x < MAP_W; x++) {
              if (!cliffMask[y][x]) continue;
              const s = this.physics.add.staticImage(x*TILE + TILE/2, y*TILE + TILE/2, "cliff");
              s.setVisible(false);
              s.body.setSize(TILE, TILE);
              cliffBodies.push(s);
            }
          }

          // animations (single-frame idle/walk per direction for now)
          // order: 0 back, 1 left, 2 front, 3 right
          this.anims.create({ key: "idle-back",  frames: [{ key: "hero", frame: 0 }], frameRate: 1, repeat: -1 });
          this.anims.create({ key: "idle-left",  frames: [{ key: "hero", frame: 1 }], frameRate: 1, repeat: -1 });
          this.anims.create({ key: "idle-front", frames: [{ key: "hero", frame: 2 }], frameRate: 1, repeat: -1 });
          this.anims.create({ key: "idle-right", frames: [{ key: "hero", frame: 3 }], frameRate: 1, repeat: -1 });
          this.anims.create({ key: "walk-back",  frames: [{ key: "hero", frame: 0 }], frameRate: 6, repeat: -1 });
          this.anims.create({ key: "walk-left",  frames: [{ key: "hero", frame: 1 }], frameRate: 6, repeat: -1 });
          this.anims.create({ key: "walk-front", frames: [{ key: "hero", frame: 2 }], frameRate: 6, repeat: -1 });
          this.anims.create({ key: "walk-right", frames: [{ key: "hero", frame: 3 }], frameRate: 6, repeat: -1 });

          // player
          this.player = this.physics.add
  .sprite(Math.floor(MAP_W/2)*TILE + TILE/2, Math.floor(MAP_H/2)*TILE + TILE/2, "hero", 2)
  .setOrigin(0.5)
  .setScale(PLAYER_SCALE);
          this.player.body.setSize(8, 8, true);
          this.player.setCollideWorldBounds(true);

          // collide with all cliff bodies
          cliffBodies.forEach(b => this.physics.add.collider(this.player, b));

          // camera
          const cam = this.cameras.main;
          cam.setBounds(0, 0, worldW, worldH);
          cam.startFollow(this.player, true, 0.15, 0.15);
          cam.setRoundPixels(true);
          cam.setZoom(CAMERA_ZOOM);

          // input (no any: add keys individually)
          const kb = this.input.keyboard!;
          this.cursors = kb.createCursorKeys();
          this.wasd = {
            W: kb.addKey(Input.Keyboard.KeyCodes.W),
            A: kb.addKey(Input.Keyboard.KeyCodes.A),
            S: kb.addKey(Input.Keyboard.KeyCodes.S),
            D: kb.addKey(Input.Keyboard.KeyCodes.D),
          };

          // hint
          this.add.text(8, 6, "WASD / Arrows to move", { color: "#ffffff", fontSize: "12px" })
            .setScrollFactor(0).setDepth(10);
        }

        update() {
          // movement
          const speed = MOVE_SPEED;
          let vx = 0;
          let vy = 0;
          if (this.cursors.left?.isDown || this.wasd.A.isDown) vx -= 1;
          if (this.cursors.right?.isDown || this.wasd.D.isDown) vx += 1;
          if (this.cursors.up?.isDown || this.wasd.W.isDown) vy -= 1;
          if (this.cursors.down?.isDown || this.wasd.S.isDown) vy += 1;
          if (vx && vy) { vx *= Math.SQRT1_2; vy *= Math.SQRT1_2; }
          this.player.setVelocity(vx * speed, vy * speed);

          // animation by dominant axis
          const moving = vx !== 0 || vy !== 0;
          if (Math.abs(vx) > Math.abs(vy)) {
            if (vx > 0) this.player.anims.play(moving ? "walk-right" : "idle-right", true);
            if (vx < 0) this.player.anims.play(moving ? "walk-left"  : "idle-left",  true);
          } else if (Math.abs(vy) > 0) {
            if (vy > 0) this.player.anims.play(moving ? "walk-front" : "idle-front", true);
            if (vy < 0) this.player.anims.play(moving ? "walk-back"  : "idle-back",  true);
          } else {
            const current = this.player.anims.currentAnim?.key ?? "idle-front";
            const idle = current.startsWith("walk-") ? current.replace("walk-", "idle-") : current;
            this.player.anims.play(idle, true);
          }
        }
      }

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current!,
        backgroundColor: "#0e0e0e",
        physics: { default: "arcade" },
        render: { pixelArt: true, antialias: false, roundPixels: true },
        scale: {
          mode: Scale.RESIZE,
          autoCenter: Scale.CENTER_BOTH,
          width: "100%",
          height: "100%",
        },
        scene: ChunkScene,
      });

      destroyGame = () => game.destroy(true);
    })();

    return () => {
      if (destroyGame) destroyGame();
      destroyGame = null;
    };
  }, [topBarHeight]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100vw",
        height: `calc(100vh - ${topBarHeight}px)`,
        marginTop: `${topBarHeight}px`, // space for your header bar
        overflow: "hidden",
      }}
    />
  );
}
