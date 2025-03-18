import { Component, Input, AfterViewInit, ViewChild, ElementRef, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { Media } from '../../models/Media';



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

  overlayText: string = '';
  inputPosition: string = 'top-right';
  showPositionMenu: boolean = false;

  private mouseMoveListener = (event: MouseEvent) => this.handleMouseMove(event);
  private canvasClickListener = (event: MouseEvent) => this.handleCanvasClick(event);

  @Input() selectedMedia?: Media;

  ngAfterViewInit() {
    this.setupCanvas();
    this.calculateTotalDuration();
    const canvas = this.canvasElement.nativeElement;
    canvas.addEventListener('mousemove', this.mouseMoveListener);
    canvas.addEventListener('click', this.canvasClickListener);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedMedia'] && this.selectedMedia) {
      const index = this.mediaItems.findIndex(item => item.name === this.selectedMedia!.name);
      if (index !== -1) {
        this.currentMediaIndex = index;
        this.cumulativeTime = this.mediaItems
          .slice(0, this.currentMediaIndex)
          .reduce((sum, media) => sum + (media.duration || 0), 0);
        this.pausedAtTime = null;
        this.imagePausedElapsed = 0;
        if (this.animationFrameId) {
          cancelAnimationFrame(this.animationFrameId);
        }
        const video = this.videoElement.nativeElement;
        video.pause(); // Arrêter toute vidéo en cours
        video.currentTime = 0; // Réinitialiser
        this.playCurrentMedia();
      }
    }
    if (changes['mediaItems']) {
      this.calculateTotalDuration();
      this.playCurrentMedia();
    }
  }

  ngOnDestroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.mediaItems.forEach(media => {
      if (media.thumbnail) URL.revokeObjectURL(media.thumbnail);
      if (media.source) URL.revokeObjectURL(media.source);
    });
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
      this.drawControls(); // Update controls to reflect paused state
    }
  }

  seekTo(progressPercentage: number) {
    const currentMedia = this.mediaItems[this.currentMediaIndex];
    if (!currentMedia) return;

    const mediaDuration = currentMedia.duration || (currentMedia.type.startsWith('image') ? 5 : 0);
    const newTime = progressPercentage * mediaDuration;

    if (currentMedia.type.startsWith('video')) {
      const video = this.videoElement.nativeElement;
      const targetTime = newTime;
      video.currentTime = targetTime;
      this.pausedAtTime = targetTime;
      this.cumulativeTime = this.mediaItems
        .slice(0, this.currentMediaIndex)
        .reduce((sum, media) => sum + (media.duration || 0), 0) + newTime;
    } else if (currentMedia.type.startsWith('image')) {
      this.imagePausedElapsed = newTime * 1000;
      this.imageStartTime = performance.now() - this.imagePausedElapsed;
      this.cumulativeTime = this.mediaItems
        .slice(0, this.currentMediaIndex)
        .reduce((sum, media) => sum + (media.duration || 0), 0) + newTime;
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
  private playCurrentMedia1() {
    const currentMedia = this.mediaItems[this.currentMediaIndex];
    if (!currentMedia) return;
  
    // Nettoyer le canvas avant de rendre un nouveau média
    this.ctx.clearRect(0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);
  
    if (currentMedia.type.startsWith('video')) {
      const video = this.videoElement.nativeElement;
  
      // Réinitialiser la source pour éviter les problèmes de cache ou d'état précédent
      video.src = '';
      video.src = currentMedia.source || currentMedia.thumbnail || `assets/${currentMedia.name}`;
      video.muted = false;
  
      video.onloadeddata = () => {
        if (!currentMedia.duration) {
          currentMedia.duration = video.duration;
          this.calculateTotalDuration();
        }
        // Si pausedAtTime est défini (par exemple via seekTo ou pause), utiliser cette valeur
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
      img.src = currentMedia.thumbnail || 'assets/default-image.jpg';
      img.onload = () => {
        this.imageStartTime = performance.now() - (this.imagePausedElapsed || 0);
        const duration = (currentMedia.duration || 5) * 1000;
        const drawImageFrame = (currentTime: number) => {
          if (!this.isPlaying) {
            this.ctx.drawImage(img, 0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);
            this.drawControls();
            return;
          }
          const elapsed = (currentTime - this.imageStartTime) / 1000;
          this.updateCumulativeTime(elapsed);
          if (elapsed >= (currentMedia.duration || 5)) {
            this.nextMedia();
          } else {
            this.ctx.drawImage(img, 0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);
            this.drawControls();
            this.animationFrameId = requestAnimationFrame(drawImageFrame);
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
 
  private playCurrentMedia11() {
    const currentMedia = this.mediaItems[this.currentMediaIndex];
    if (!currentMedia) return;
  
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);
  
    if (currentMedia.type.startsWith('video')) {
      const video = this.videoElement.nativeElement;
      video.src = ''; // Reset source to force reload
      const videoSource = currentMedia.source || `assets/${currentMedia.name}`; // Prioritize source over thumbnail
      video.src = videoSource;
  
      video.onloadeddata = () => {
        if (!currentMedia.duration) {
          currentMedia.duration = video.duration;
          this.calculateTotalDuration();
        }
        video.currentTime = this.pausedAtTime || 0; // Set to 0 or paused time
        if (this.isPlaying) {
          video.play().catch(err => console.error('Erreur de lecture vidéo :', err));
        }
        this.renderVideoFrame(); // Render immediately, even if paused
      };
  
      video.onerror = () => {
        console.error(`Erreur de chargement de la vidéo : ${currentMedia.name}`);
        // Instead of nextMedia(), show an error on canvas
        this.ctx.fillStyle = 'red';
        this.ctx.fillText(`Erreur: ${currentMedia.name}`, 10, 50);
      };
    } else if (currentMedia.type.startsWith('image')) {
      const img = new Image();
      img.src = currentMedia.thumbnail || currentMedia.source || 'assets/default-image.jpg';
      img.onload = () => {
        this.imageStartTime = performance.now() - (this.imagePausedElapsed || 0);
        const drawImageFrame = (currentTime: number) => {
          this.ctx.drawImage(img, 0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);
          this.drawControls();
          if (this.isPlaying) {
            const elapsed = (currentTime - this.imageStartTime) / 1000;
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
        this.ctx.fillStyle = 'red';
        this.ctx.fillText(`Erreur: ${currentMedia.name}`, 10, 50);
      };
    }
  }
  private renderVideoFrame() {
    const canvas = this.canvasElement.nativeElement;
    const video = this.videoElement.nativeElement;
    this.ctx.drawImage(video, 0, 0, canvas.width, canvas.height); // Draw current frame
    this.drawControls();
    if (this.isPlaying && !video.paused && !video.ended) {
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

    const currentMedia = this.mediaItems[this.currentMediaIndex];
    let progressPercentage = 0;

    if (currentMedia) {
      const mediaDuration = currentMedia.duration || (currentMedia.type.startsWith('image') ? 5 : 0);
      let elapsedTime = 0;

      if (currentMedia.type.startsWith('video')) {
        const video = this.videoElement.nativeElement;
        elapsedTime = video.currentTime;
      } else if (currentMedia.type.startsWith('image')) {
        elapsedTime = (performance.now() - this.imageStartTime) / 1000;
        if (this.imagePausedElapsed > 0 && !this.isPlaying) {
          elapsedTime = this.imagePausedElapsed / 1000;
        }
      }

      progressPercentage = mediaDuration > 0 ? (elapsedTime / mediaDuration) * 100 : 0;
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
  
    // Réinitialiser les variables d'état
    this.pausedAtTime = null;
    this.imagePausedElapsed = 0;
    this.imageStartTime = 0;
  
    const video = this.videoElement.nativeElement;
    video.pause(); // S'assurer que la vidéo est arrêtée
    video.currentTime = 0; // Réinitialiser la position de la vidéo
  
    if (this.mediaItems.length > 0) {
      this.currentMediaIndex = (this.currentMediaIndex + 1) % this.mediaItems.length;
  
      // Réinitialiser cumulativeTime si on boucle au début
      if (this.currentMediaIndex === 0) {
        this.cumulativeTime = 0;
      }
  
      // Jouer le prochain média uniquement si isPlaying est vrai
      if (this.isPlaying) {
        this.playCurrentMedia();
      } else {
        // Si pas en lecture, simplement dessiner le média actuel (utile pour selectedMedia)
        this.playCurrentMedia();
      }
    }
  }
  selectMedia(index: number) {
    this.currentMediaIndex = index;
    this.cumulativeTime = this.mediaItems
      .slice(0, this.currentMediaIndex)
      .reduce((sum, media) => sum + (media.duration || 0), 0);
    this.pausedAtTime = null;
    this.imagePausedElapsed = 0;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    const video = this.videoElement.nativeElement;
    video.pause(); 
    
   
    this.ctx.clearRect(0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);
    
   
    this.playCurrentMedia();
  }
  private playCurrentMedia() {
    const currentMedia = this.mediaItems[this.currentMediaIndex];
    if (!currentMedia) return;

    this.ctx.clearRect(0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);

    if (currentMedia.type.startsWith('video') || /\.(mp4|avi|mov|wmv|webm|ogg|mkv|flv|3gp|mpeg|mpg|ts|vob)$/i.test(currentMedia.name)) {
      const video = this.videoElement.nativeElement;
      video.src = '';
      video.src = currentMedia.source || currentMedia.thumbnail || `assets/${currentMedia.name}`;
      video.muted = false;
      
      // Ajout d'attributs pour meilleure compatibilité
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');

      video.onloadeddata = () => {
        if (!currentMedia.duration) {
          currentMedia.duration = video.duration;
          this.calculateTotalDuration();
        }
        video.currentTime = this.pausedAtTime || 0;
        if (this.isPlaying) {
          video.play().catch(err => {
            console.error('Erreur de lecture vidéo :', err);
            this.nextMedia();
          });
        }
        this.renderVideoFrame();
      };

      video.onerror = () => {
        console.error(`Erreur de chargement de la vidéo : ${currentMedia.name}`);
        this.nextMedia();
      };

      video.ontimeupdate = () => {
        const elapsed = video.currentTime;
        this.updateCumulativeTime(elapsed);
        if (elapsed >= (currentMedia.duration || video.duration)) {
          video.pause();
          this.nextMedia();
        }
      };
    } else if (currentMedia.type.startsWith('image') || /\.(jpg|jpeg|png|gif|bmp|webp|tiff|tif|svg)$/i.test(currentMedia.name)) {
      const img = new Image();
      img.src = currentMedia.thumbnail || currentMedia.source || 'assets/default-image.jpg';
      
      img.onload = () => {
        this.imageStartTime = performance.now() - (this.imagePausedElapsed || 0);
        const duration = (currentMedia.duration || 5) * 1000;
        const drawImageFrame = (currentTime: number) => {
          if (!this.isPlaying) {
            this.ctx.drawImage(img, 0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);
            this.drawControls();
            return;
          }
          const elapsed = (currentTime - this.imageStartTime) / 1000;
          this.updateCumulativeTime(elapsed);
          if (elapsed >= (currentMedia.duration || 5)) {
            this.nextMedia();
          } else {
            this.ctx.drawImage(img, 0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);
            this.drawControls();
            this.animationFrameId = requestAnimationFrame(drawImageFrame);
          }
        };
        this.animationFrameId = requestAnimationFrame(drawImageFrame);
      };
    }
  }
  private playCurrentMedia5() {
    const currentMedia = this.mediaItems[this.currentMediaIndex];
    if (!currentMedia) return;

    this.ctx.clearRect(0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);

    if (currentMedia.type.startsWith('video') || /\.(mp4|avi|mov|wmv|webm|ogg|mkv|flv|3gp|mpeg|mpg|ts|vob)$/i.test(currentMedia.name)) {
      const video = this.videoElement.nativeElement;
      video.src = '';
      video.src = currentMedia.source || currentMedia.thumbnail || `assets/${currentMedia.name}`;
      video.muted = false;
      
      // Ajout d'attributs pour meilleure compatibilité
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');

      video.onloadeddata = () => {
        if (!currentMedia.duration) {
          currentMedia.duration = video.duration;
          this.calculateTotalDuration();
        }
        video.currentTime = this.pausedAtTime || 0;
        if (this.isPlaying) {
          video.play().catch(err => {
            console.error('Erreur de lecture vidéo :', err);
            this.nextMedia();
          });
        }
        this.renderVideoFrame();
      };

      video.onerror = () => {
        console.error(`Erreur de chargement de la vidéo : ${currentMedia.name}`);
        this.nextMedia();
      };

      video.ontimeupdate = () => {
        const elapsed = video.currentTime;
        this.updateCumulativeTime(elapsed);
        if (elapsed >= (currentMedia.duration || video.duration)) {
          video.pause();
          this.nextMedia();
        }
      };
    } else if (currentMedia.type.startsWith('image') || /\.(jpg|jpeg|png|gif|bmp|webp|tiff|tif|svg)$/i.test(currentMedia.name)) {
      const img = new Image();
      img.src = currentMedia.thumbnail || currentMedia.source || 'assets/default-image.jpg';
      
      img.onload = () => {
        this.imageStartTime = performance.now() - (this.imagePausedElapsed || 0);
        const duration = (currentMedia.duration || 5) * 1000;
        const drawImageFrame = (currentTime: number) => {
          if (!this.isPlaying) {
            this.ctx.drawImage(img, 0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);
            this.drawControls();
            return;
          }
          const elapsed = (currentTime - this.imageStartTime) / 1000;
          this.updateCumulativeTime(elapsed);
          if (elapsed >= (currentMedia.duration || 5)) {
            this.nextMedia();
          } else {
            this.ctx.drawImage(img, 0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);
            this.drawControls();
            this.animationFrameId = requestAnimationFrame(drawImageFrame);
          }
        };
        this.animationFrameId = requestAnimationFrame(drawImageFrame);
      };
    }
  }
  
  private playCurrentMedia3() {
    const currentMedia = this.mediaItems[this.currentMediaIndex];
    if (!currentMedia) return;
  
    // Nettoyer le canvas avant de rendre un nouveau média
    this.ctx.clearRect(0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);
  
    if (currentMedia.type.startsWith('video')) {
      const video = this.videoElement.nativeElement;
  
      // Réinitialiser la source pour éviter les problèmes de cache ou d'état précédent
      video.src = '';
      video.src = currentMedia.source || currentMedia.thumbnail || `assets/${currentMedia.name}`;
      video.muted = false;
  
      video.onloadeddata = () => {
        if (!currentMedia.duration) {
          currentMedia.duration = video.duration;
          this.calculateTotalDuration();
        }
        // Si pausedAtTime est défini (par exemple via seekTo ou pause), utiliser cette valeur
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
      img.src = currentMedia.thumbnail || 'assets/default-image.jpg';
      img.onload = () => {
        this.imageStartTime = performance.now() - (this.imagePausedElapsed || 0);
        const duration = (currentMedia.duration || 5) * 1000;
        const drawImageFrame = (currentTime: number) => {
          if (!this.isPlaying) {
            this.ctx.drawImage(img, 0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);
            this.drawControls();
            return;
          }
          const elapsed = (currentTime - this.imageStartTime) / 1000;
          this.updateCumulativeTime(elapsed);
          if (elapsed >= (currentMedia.duration || 5)) {
            this.nextMedia();
          } else {
            this.ctx.drawImage(img, 0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);
            this.drawControls();
            this.animationFrameId = requestAnimationFrame(drawImageFrame);
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
  
}