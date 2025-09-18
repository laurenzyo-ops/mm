"use client";
import { useEffect, useRef } from "react";
import Phaser from "phaser";

export default function ChunkSceneWrapper() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    class ChunkScene extends Phaser.Scene {
      private player!: Phaser.Physics.Arcade.Sprite;
      private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

      preload() {
        this.load.image("player", "/sprites/player.png");
        this.load.image("floor", "/sprites/floor.png");
      }

      create() {
        for (let x = 0; x < 20; x++) {
          for (let y = 0; y < 20; y++) {
            this.add.image(x * 32, y * 32, "floor").setOrigin(0);
          }
        }

        this.player = this.physics.add.sprite(320, 320, "player");

        const kb = this.input.keyboard;
        if (!kb) throw new Error("Keyboard plugin not available");
        this.cursors = kb.createCursorKeys();
      }

      update() {
        const speed = 200;
        this.player.setVelocity(0);

        if (this.cursors.left?.isDown) this.player.setVelocityX(-speed);
        if (this.cursors.right?.isDown) this.player.setVelocityX(speed);
        if (this.cursors.up?.isDown) this.player.setVelocityY(-speed);
        if (this.cursors.down?.isDown) this.player.setVelocityY(speed);
      }
    }

    // ✅ richtiger Typ statt any
    let game: Phaser.Game | null = new Phaser.Game({
      type: Phaser.AUTO,
      width: 640,
      height: 640,
      physics: { default: "arcade" },
      input: { keyboard: true },
      scene: ChunkScene,
      parent: ref.current,
    });

    return () => {
      if (game) {
        game.destroy(true);
        game = null;
      }
    };
  }, []);

  return <div ref={ref} style={{ width: 640, height: 640 }} />;
}
