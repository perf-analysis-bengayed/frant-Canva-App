import { Component, Input, AfterViewInit, ViewChild, ElementRef, OnDestroy, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

interface Media {
  name: string;
  type: string;
  duration?: number;
  startTime?: number;
  endTime?: number;
  thumbnail?: string;
  originalDuration?: number;
  source?: string;
  overlayText?: string;
  textPosition?: string;
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
  private pausedAtTime: number | null = null;
  currentMediaIndex = 0;
  totalDuration = 0;
  cumulativeTime = 0;
  private ctx!: CanvasRenderingContext2D;
  private animationFrameId: number | null = null;
  private isPlaying = false;
  private isHoveringControls = false;
  private controlsVisible = true;
  private lastMouseMove = 0;
  private currentBlobUrls: string[] = [];
  private mediaStartTime: number = 0;
  private pausedElapsed: number = 0;
  private drawCurrentFrame: (() => void) | null = null;

 
  private mouseMoveListener = (event: MouseEvent) => this.handleMouseMove(event);
  private canvasClickListener = (event: MouseEvent) => this.handleCanvasClick(event);
 
  @Input() selectedMedia?: Media;
  @Input() durationChange: { media: Media, newDuration: number } | null = null;
  constructor(private cdr: ChangeDetectorRef) {}
  ngAfterViewInit() {
    this.setupCanvas();
    this.calculateTotalDuration();
    const canvas = this.canvasElement.nativeElement;
    canvas.addEventListener('mousemove', this.mouseMoveListener);
    canvas.addEventListener('click', this.canvasClickListener);
    if (this.mediaItems.length > 0) {
      this.playSequence();
    }
  }


  ngOnChanges(changes: SimpleChanges) {

    if (changes['mediaItems']) {
      this.calculateTotalDuration();
      this.playCurrentMedia();
    }
    if (changes['durationChange'] && this.durationChange) {
      const { media, newDuration } = this.durationChange;
      if (media === this.mediaItems[this.currentMediaIndex]) {
        this.pauseSequence();
        media.duration = newDuration;
        this.calculateTotalDuration();
        this.playCurrentMedia();
      }
    }
    if (changes['selectedMedia'] && this.selectedMedia) {
      const index = this.mediaItems.findIndex(item => item.name === this.selectedMedia!.name);
      if (index !== -1) {
        this.currentMediaIndex = index;
        this.cumulativeTime = this.mediaItems
          .slice(0, this.currentMediaIndex)
          .reduce((sum, media) => sum + (media.duration || 0), 0);
        this.pausedElapsed = 0;
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        const video = this.videoElement.nativeElement;
        video.pause();
        video.currentTime = 0;
        this.playCurrentMedia();
      }
    }
  }


  getEffectiveDuration(media: any): number {
    return media.duration || 0;
  }

  ngOnDestroy() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    const video = this.videoElement.nativeElement;
    video.pause();
    video.src = '';
    video.load();
    this.mediaItems.forEach(media => {
      if (media.thumbnail) URL.revokeObjectURL(media.thumbnail);
      if (media.source && media.source.startsWith('blob:')) {URL.revokeObjectURL(media.source);}
    });
    const canvas = this.canvasElement.nativeElement;
    canvas.removeEventListener('mousemove', this.mouseMoveListener);
    canvas.removeEventListener('click', this.canvasClickListener);
  }
  private calculateTotalDuration(): void {
    this.totalDuration = this.mediaItems.reduce((sum, media) => {
      return sum + (this.getEffectiveDuration(media) || (media.type.startsWith('image') ? 5 : 0));
    }, 0);
    this.cdr.detectChanges(); // Forcer la mise à jour de la vue
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
      if (x >= 10 && x <= 40) {
        this.togglePlayPause();
      } else if (x >= 50 && x <= canvas.width - 50) {
        const progressPercentage = (x - 50) / (canvas.width - 100);
        this.seekTo(progressPercentage);
      } else if (x >= canvas.width - 40) {
        this.toggleFullscreen();
      }
    } else {
      this.togglePlayPause();
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
      this.startMediaSequence();
    }
  }

  private pauseSequence() {
    if (this.isPlaying) {
      this.isPlaying = false;
      if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
      const currentMedia = this.mediaItems[this.currentMediaIndex];
      if (currentMedia) {
        this.pausedElapsed = (performance.now() - this.mediaStartTime) / 1000;
        if (currentMedia.type.startsWith('video')) {
          this.videoElement.nativeElement.pause();
        }
      }
      this.drawControls();
    }
  }

  seekTo(progressPercentage: number) {
    const currentMedia = this.mediaItems[this.currentMediaIndex];
    if (!currentMedia) return;

    const setDuration = currentMedia.duration || (currentMedia.type.startsWith('image') ? 5 : this.videoElement.nativeElement.duration);
    const newElapsed = progressPercentage * setDuration;

    this.pausedElapsed = newElapsed;
    this.mediaStartTime = performance.now() - this.pausedElapsed * 1000;

    if (currentMedia.type.startsWith('video')) {
      const video = this.videoElement.nativeElement;
      video.currentTime = newElapsed % video.duration;
    }

    if (this.isPlaying) {
      this.startMediaSequence();
    } else {
      this.playCurrentMedia();
    }
  }

  toggleFullscreen() {
    const canvas = this.canvasElement.nativeElement;
    if (!document.fullscreenElement) {
      canvas.requestFullscreen().catch(err => console.error('Error entering fullscreen:', err));
    } else {
      document.exitFullscreen();
    }
  }

  private startMediaSequence() {
    if (this.mediaItems.length > 0 && this.isPlaying) {
      this.playCurrentMedia();
    }
  }

  private playCurrentMedia() {
    const currentMedia = this.mediaItems[this.currentMediaIndex];
    if (!currentMedia) return;
    this.currentBlobUrls.forEach(url => URL.revokeObjectURL(url));
  this.currentBlobUrls = [];
    this.ctx.clearRect(0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);
    this.mediaStartTime = performance.now() - (this.pausedElapsed * 1000);

    if (currentMedia.type.startsWith('video')) {
      const video = this.videoElement.nativeElement;
      video.src = '';
      video.src = currentMedia.source || currentMedia.thumbnail || `assets/${currentMedia.name}`;
      video.muted = false;

      this.drawCurrentFrame = () => {
        this.ctx.drawImage(video, 0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);
        const currentMedia = this.mediaItems[this.currentMediaIndex];
        
        if (currentMedia && currentMedia.overlayText) {
          const position = currentMedia.textPosition || 'top-right';
          this.drawOverlayText(currentMedia.overlayText, position);
        }
      };
      const handleVideoEnded = () => {
        const elapsed = (performance.now() - this.mediaStartTime) / 1000;
        const setDuration = currentMedia.duration || video.duration;
        if (elapsed < setDuration) {
          video.currentTime = 0;
          video.play();

        }
      };
      video.onloadeddata = () => {
        if (!currentMedia.duration) {
          currentMedia.duration = video.duration;
          this.calculateTotalDuration();
          this.cdr.detectChanges();
        }
        video.currentTime = this.pausedElapsed % video.duration;
        video.addEventListener('ended', handleVideoEnded);
        video.currentTime = this.pausedAtTime || 0;
        if (this.isPlaying) {
          video.play().catch(err => console.error('Erreur de lecture vidéo :', err));
        }
        this.renderVideoFrame();
      };

      video.onerror = () => {
        console.error(`Erreur de chargement de la vidéo : ${currentMedia.name}`);
        this.nextMedia();
      };
      video.oncanplay = () => {
        if (this.isPlaying) {
          video.play().catch(err => console.error('Erreur de lecture vidéo :', err));
        }
        this.renderVideoFrame();
      };
      video.ontimeupdate = () => {
        const elapsed = video.currentTime;
        this.updateCumulativeTime(elapsed);
        if (elapsed >= (currentMedia.duration || video.duration)) {
          video.pause();
          this.nextMedia();
        }
      };
    } else if (currentMedia.type.startsWith('image')) {
      const img = new Image();
      img.src = currentMedia.thumbnail || currentMedia.source || 'assets/default-image.jpg';
      img.onload = () => {
        this.drawCurrentFrame = () => {
          this.ctx.drawImage(img, 0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);
          if (currentMedia.overlayText) {
            this.drawOverlayText(currentMedia.overlayText, currentMedia.textPosition || '0');
          }
        };
        const drawImageFrame = (currentTime: number) => {
          this.drawCurrentFrame?.();
          this.drawControls();
          if (this.isPlaying) {
            const elapsed = (currentTime - this.mediaStartTime) / 1000;
            this.updateCumulativeTime(elapsed);
            if (elapsed >= (currentMedia.duration || 5)) {
              this.nextMedia();
            } else {
              this.animationFrameId = requestAnimationFrame(drawImageFrame);
            }
          }
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
    this.drawCurrentFrame?.();
    this.drawControls();
    const video = this.videoElement.nativeElement;
    if (this.isPlaying && !video.paused && !video.ended) {
      this.animationFrameId = requestAnimationFrame(() => this.renderVideoFrame());
    }
  }

  private drawOverlayText(text: string, position: string) {
    const canvas = this.canvasElement.nativeElement;
    this.ctx.font = '30px Arial';
    this.ctx.fillStyle = 'white';
    this.ctx.textAlign = 'left';

    let x: number;
    let y: number;

    switch (position) {
      case '0': // Gauche Haut
        x = 10;
        y = 30;
        break;
      case '1': // Droite Haut
        x = canvas.width - 10;
        this.ctx.textAlign = 'right';
        y = 30;
        break;
      case '2': // Gauche Bas
        x = 10;
        y = canvas.height - 60;
        break;
      case '3': // Droite Bas
        x = canvas.width - 10;
        this.ctx.textAlign = 'right';
        y = canvas.height - 60;
        break;
      case '4': // Centre
        x = canvas.width / 2;
        y = canvas.height / 2;
        this.ctx.textAlign = 'center';
        break;
      default:
        x = 10;
        y = 30;
    }
    this.ctx.fillText(text, x, y);
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

    const currentMedia = this.mediaItems[this.currentMediaIndex];
    let progressPercentage = 0;

    if (currentMedia) {
      const setDuration = currentMedia.duration || (currentMedia.type.startsWith('image') ? 5 : this.videoElement.nativeElement.duration);
      const elapsed = this.isPlaying ? (performance.now() - this.mediaStartTime) / 1000 : this.pausedElapsed;
      progressPercentage = setDuration > 0 ? (elapsed / setDuration) * 100 : 0;
      progressPercentage = Math.min(100, Math.max(0, progressPercentage));
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
      this.animationFrameId = null;
    }

    this.pausedElapsed = 0;
    const video = this.videoElement.nativeElement;
    video.pause();
    video.currentTime = 0;

    if (this.mediaItems.length > 0) {
      this.currentMediaIndex = (this.currentMediaIndex + 1) % this.mediaItems.length;
      if (this.currentMediaIndex === 0) this.cumulativeTime = 0;
      this.playCurrentMedia();
    }
  }

  selectMedia(index: number) {
    this.currentMediaIndex = index;
    this.cumulativeTime = this.mediaItems
      .slice(0, this.currentMediaIndex)
      .reduce((sum, media) => sum + (media.duration || 0), 0);
    this.pausedElapsed = 0;

    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    
    this.playSequence();

    this.ctx.clearRect(0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);
    this.playCurrentMedia();

  }

  onTextPositionChange() {
    this.playCurrentMedia(); // Redraw the current frame with updated text/position
  }


}