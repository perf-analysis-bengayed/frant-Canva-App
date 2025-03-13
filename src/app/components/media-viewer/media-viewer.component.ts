import { Component, Input, AfterViewInit, ViewChild, ElementRef, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';

interface Media {
  name: string;
  type: string;
  duration?: number;
  startTime?: number;
  endTime?: number;
  thumbnail?: string;
}

@Component({
  selector: 'app-media-viewer',
  templateUrl: './media-viewer.component.html',
  styleUrls: ['./media-viewer.component.css']
})
export class MediaViewerComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() mediaItems: Media[] = [];
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;

  currentMediaIndex = 0;
  totalDuration = 0;
  cumulativeTime = 0;
  private ctx!: CanvasRenderingContext2D;
  private animationFrameId: number | null = null;
  private isPlaying = false;
  private isHoveringControls = false;
  private controlsVisible = true;
  private lastMouseMove = 0;

  private pausedAtTime: number | null = null;
  private imageStartTime: number = 0;
  private imagePausedElapsed: number = 0;

  // Propriétés pour le texte overlay
  overlayText: string = '';
  inputPosition: string = 'top-right';
  showPositionMenu: boolean = false;

  private mouseMoveListener = (event: MouseEvent) => this.handleMouseMove(event);
  private canvasClickListener = (event: MouseEvent) => this.handleCanvasClick(event);

  ngAfterViewInit() {
    this.setupCanvas();
    this.calculateTotalDuration();
    const canvas = this.canvasElement.nativeElement;
    canvas.addEventListener('mousemove', this.mouseMoveListener);
    canvas.addEventListener('click', this.canvasClickListener);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['mediaItems']) {
      this.currentMediaIndex = 0;
      this.cumulativeTime = 0;
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
      this.calculateTotalDuration();
      if (this.isPlaying) {
        this.startMediaSequence();
      }
    }
  }

  ngOnDestroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    const canvas = this.canvasElement.nativeElement;
    canvas.removeEventListener('mousemove', this.mouseMoveListener);
    canvas.removeEventListener('click', this.canvasClickListener);
  }

  private calculateTotalDuration() {
    this.totalDuration = this.mediaItems.reduce((sum, media) => {
      return sum + (media.duration || (media.type.startsWith('image') ? 5 : 0));
    }, 0);
  }

  private setupCanvas() {
    const canvas = this.canvasElement.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    canvas.width = 800;
    canvas.height = 450;
  }

  private handleMouseMove(event: MouseEvent) {
    this.lastMouseMove = Date.now();
    this.controlsVisible = true;
    const canvas = this.canvasElement.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const y = event.clientY - rect.top;
    this.isHoveringControls = y > (canvas.height - 40);
  }

  private handleCanvasClick(event: MouseEvent) {
    const canvas = this.canvasElement.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (y > canvas.height - 40) {
      const progressBarStart = 50;
      const progressBarWidth = canvas.width - 100;

      if (x >= 10 && x <= 40) {
        this.togglePlayPause();
      } else if (x >= progressBarStart && x <= progressBarStart + progressBarWidth) {
        const progressPercentage = (x - progressBarStart) / progressBarWidth;
        this.seekTo(progressPercentage);
      } else if (x >= canvas.width - 40) {
        this.toggleFullscreen();
      }
    }
  }

  togglePlayPause() {
    if (this.isPlaying) {
      this.pauseSequence();
    } else {
      this.playSequence();
    }
  }

  private playSequence() {
    if (!this.isPlaying) {
      this.isPlaying = true;
      const currentMedia = this.mediaItems[this.currentMediaIndex];
      if (currentMedia) {
        const previousMediaDuration = this.mediaItems
          .slice(0, this.currentMediaIndex)
          .reduce((sum, media) => sum + (media.duration || 0), 0);

        if (currentMedia.type.startsWith('video')) {
          const video = this.videoElement.nativeElement;
          video.currentTime = this.pausedAtTime !== null ? this.pausedAtTime : (currentMedia.startTime || 0);
          const currentMediaElapsed = video.currentTime - (currentMedia.startTime || 0);
          this.cumulativeTime = previousMediaDuration + currentMediaElapsed;
          video.play().catch(err => console.error('Erreur de lecture vidéo :', err));
        } else if (currentMedia.type.startsWith('image')) {
          const currentMediaElapsed = this.imagePausedElapsed / 1000;
          this.cumulativeTime = previousMediaDuration + currentMediaElapsed;
        }
      }
      this.startMediaSequence();
    }
  }

  private pauseSequence() {
    if (this.isPlaying) {
      this.isPlaying = false;
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
      const currentMedia = this.mediaItems[this.currentMediaIndex];
      if (currentMedia) {
        if (currentMedia.type.startsWith('video')) {
          const video = this.videoElement.nativeElement;
          video.pause();
          this.pausedAtTime = video.currentTime;
        } else if (currentMedia.type.startsWith('image')) {
          this.imagePausedElapsed = performance.now() - this.imageStartTime;
        }
      }
    }
  }

  seekTo(progressPercentage: number) {
    const currentMedia = this.mediaItems[this.currentMediaIndex];
    if (!currentMedia) return;

    const mediaDuration = currentMedia.duration || (currentMedia.type.startsWith('image') ? 5 : 0);
    const newTime = progressPercentage * mediaDuration;

    if (currentMedia.type.startsWith('video')) {
      const video = this.videoElement.nativeElement;
      const targetTime = newTime + (currentMedia.startTime || 0);
      video.currentTime = targetTime;
      this.pausedAtTime = targetTime;
    } else if (currentMedia.type.startsWith('image')) {
      this.imagePausedElapsed = newTime * 1000;
      this.imageStartTime = performance.now() - this.imagePausedElapsed;
    }

    if (this.isPlaying) {
      this.startMediaSequence();
    } else {
      this.drawControls();
    }
  }

  toggleFullscreen() {
    const canvas = this.canvasElement.nativeElement;
    if (!document.fullscreenElement) {
      canvas.requestFullscreen().catch(err => console.error('Erreur plein écran :', err));
    } else {
      document.exitFullscreen();
    }
  }

  togglePositionMenu() {
    this.showPositionMenu = !this.showPositionMenu;
  }

  setPosition(position: string) {
    this.inputPosition = position;
    this.showPositionMenu = false;
  }

  private startMediaSequence() {
    if (this.mediaItems.length > 0 && this.isPlaying) {
      this.playCurrentMedia();
    }
  }

  private playCurrentMedia() {
    const currentMedia = this.mediaItems[this.currentMediaIndex];
    if (!currentMedia) return;

    this.ctx.clearRect(0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);

    if (currentMedia.type.startsWith('video')) {
      const video = this.videoElement.nativeElement;
      video.src = currentMedia.thumbnail || `assets/${currentMedia.name}`;
      
console.log('Tentative de chargement de la vidéo depuis :', video.src); 
      video.muted = false;

      video.onloadeddata = () => {
        if (!currentMedia.duration) {
          currentMedia.duration = video.duration;
          this.calculateTotalDuration();
        }
        console.log(`Vidéo chargée : ${currentMedia.name}`);
        if (this.isPlaying) {
          video.currentTime = this.pausedAtTime !== null ? this.pausedAtTime : (currentMedia.startTime || 0);
          video.play().catch(err => console.error('Erreur de lecture vidéo :', err));
        }
        this.renderVideoFrame();
      };

      video.onerror = () => {
        console.error(`Erreur de chargement de la vidéo : ${currentMedia.name}`);
        this.nextMedia();
      };

      video.ontimeupdate = () => {
        const relativeTime = video.currentTime - (currentMedia.startTime || 0);
        this.updateCumulativeTime(relativeTime);
        if (relativeTime >= (currentMedia.duration || video.duration)) {
          video.pause();
          this.nextMedia();
        }
      };
    } else if (currentMedia.type.startsWith('image')) {
      const img = new Image();
      img.src = currentMedia.thumbnail || 'assets/default-image.jpg';
      img.onload = () => {
        this.imageStartTime = performance.now();
        if (this.imagePausedElapsed > 0) {
          this.imageStartTime = performance.now() - this.imagePausedElapsed;
          const previousMediaDuration = this.mediaItems
            .slice(0, this.currentMediaIndex)
            .reduce((sum, media) => sum + (media.duration || 0), 0);
          const currentMediaElapsed = this.imagePausedElapsed / 1000;
          this.cumulativeTime = previousMediaDuration + currentMediaElapsed;
        }
        const duration = (currentMedia.duration || 5) * 1000;
        const drawImageFrame = (currentTime: number) => {
          if (!this.isPlaying) return;
          const elapsed = (currentTime - this.imageStartTime) / 1000;
          this.updateCumulativeTime(elapsed);
          if (elapsed >= (currentMedia.duration || 5)) {
            this.nextMedia();
            return;
          }
          this.ctx.drawImage(img, 0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);
          this.drawControls();
          this.animationFrameId = requestAnimationFrame(drawImageFrame);
        };
        this.animationFrameId = requestAnimationFrame(drawImageFrame);
      };
      img.onerror = () => {
        console.error(`Erreur de chargement de l'image : ${currentMedia.name}`);
        this.nextMedia();
      };
    }
  }

  private renderVideoFrame() {
    const canvas = this.canvasElement.nativeElement;
    const video = this.videoElement.nativeElement;
    if (!video.paused && !video.ended && this.isPlaying) {
      this.ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      this.drawControls();
      this.animationFrameId = requestAnimationFrame(() => this.renderVideoFrame());
    }
  }

  private updateCumulativeTime(elapsed: number) {
    const previousMediaDuration = this.mediaItems
      .slice(0, this.currentMediaIndex)
      .reduce((sum, media) => sum + (media.duration || 0), 0);
    this.cumulativeTime = Math.max(0, previousMediaDuration + elapsed);
    this.cumulativeTime = Math.min(this.cumulativeTime, this.totalDuration);
  }

  private drawControls() {
    const canvas = this.canvasElement.nativeElement;
    const controlHeight = 40;
    const controlY = canvas.height - controlHeight;

    if (Date.now() - this.lastMouseMove > 3000 && !this.isHoveringControls) {
      this.controlsVisible = false;
    }

    if (!this.controlsVisible) return;

    this.ctx.fillStyle = 'rgba(15, 15, 15, 0.8)';
    this.ctx.fillRect(0, controlY, canvas.width, controlHeight);

    this.ctx.fillStyle = '#fff';
    this.ctx.font = '18px Arial';
    this.ctx.fillText(this.isPlaying ? '❚❚' : '▶', 20, controlY + 25);

    const progressBarWidth = canvas.width - 100;
    const progressBarX = 50;

    // Calcul de la progression basée sur le média actuel uniquement
    const currentMedia = this.mediaItems[this.currentMediaIndex];
    let progressPercentage = 0;

    if (currentMedia) {
      const mediaDuration = currentMedia.duration || (currentMedia.type.startsWith('image') ? 5 : 0);
      let elapsedTime = 0;

      if (currentMedia.type.startsWith('video')) {
        const video = this.videoElement.nativeElement;
        elapsedTime = video.currentTime - (currentMedia.startTime || 0);
      } else if (currentMedia.type.startsWith('image')) {
        elapsedTime = (performance.now() - this.imageStartTime) / 1000;
        if (this.imagePausedElapsed > 0 && !this.isPlaying) {
          elapsedTime = this.imagePausedElapsed / 1000;
        }
      }

      progressPercentage = mediaDuration > 0 ? (elapsedTime / mediaDuration) * 100 : 0;
      progressPercentage = Math.min(100, Math.max(0, progressPercentage)); // Limiter entre 0 et 100%
    }

    this.ctx.fillStyle = '#555';
    this.ctx.fillRect(progressBarX, controlY + 15, progressBarWidth, 4);
    this.ctx.fillStyle = '#f00';
    this.ctx.fillRect(progressBarX, controlY + 15, (progressPercentage / 100) * progressBarWidth, 4);

    this.ctx.fillStyle = '#fff';
    this.ctx.font = '18px Arial';
    this.ctx.fillText('⛶', canvas.width - 30, controlY + 25);
  }

  private nextMedia() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.pausedAtTime = null;
    this.imagePausedElapsed = 0;
    this.imageStartTime = 0; // Réinitialiser pour la prochaine image
    this.currentMediaIndex++;

    if (this.currentMediaIndex < this.mediaItems.length) {
      this.playCurrentMedia();
    } else {
      // Fin de la liste : arrêter la lecture et garder la barre à 0 pour le prochain démarrage
      this.isPlaying = false;
      this.currentMediaIndex = 0;
      this.cumulativeTime = 0; // Réinitialiser le temps cumulé
      const canvas = this.canvasElement.nativeElement;
      this.ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.drawControls();
    }
  }
}