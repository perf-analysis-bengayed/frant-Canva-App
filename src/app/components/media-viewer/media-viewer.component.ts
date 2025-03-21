import { Component, Input, AfterViewInit, ViewChild, ElementRef, OnDestroy, OnChanges, SimpleChanges, ChangeDetectorRef, EventEmitter, Output } from '@angular/core';

export interface TextOverlay {
  overlayText?: string;
  textPosition?: string;
  startTime?: number;
  displayDuration?: number;
}

export interface Media {
  name: string;
  type: string;
  duration?: number;
  source?: string;
  thumbnail?: string;
  texts: TextOverlay[]; 
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
  @Output() mediaItemsChange = new EventEmitter<Media[]>();
  private pausedAtTime: number | null = null;
  currentMediaIndex = 0;
  totalDuration = 0;
  cumulativeTime = 0;
  scale = 50; // Échelle pour les barres (50 pixels par seconde)
  private ctx!: CanvasRenderingContext2D;
  private animationFrameId: number | null = null;
  private isPlaying = false;
  private isHoveringControls = false;
  private controlsVisible = true;
  private lastMouseMove = 0;
  private currentBlobUrls: string[] = [];
  private mediaStartTime: number = 0;
  private pausedElapsed: number = 0;
  private isFullscreen = false;
  private drawCurrentFrame: (() => void) | null = null;

  private mouseMoveListener = (event: MouseEvent) => this.handleMouseMove(event);
  private canvasClickListener = (event: MouseEvent) => this.handleCanvasClick(event);

  @Input() selectedMedia?: Media;
  @Input() durationChange: { media: Media, newDuration: number } | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit1() {
    this.setupCanvas();
    this.calculateTotalDuration();
    const canvas = this.canvasElement.nativeElement;
    canvas.addEventListener('mousemove', this.mouseMoveListener);
    canvas.addEventListener('click', this.canvasClickListener);
    if (this.mediaItems.length > 0) {
      this.playSequence();
    }
  }
  ngAfterViewInit() {
    this.setupCanvas();
    this.calculateTotalDuration();
    const canvas = this.canvasElement.nativeElement;
    canvas.addEventListener('mousemove', this.mouseMoveListener);
    canvas.addEventListener('click', this.canvasClickListener);
  
    // Add fullscreen change listener
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && this.isFullscreen) {
        this.isFullscreen = false;
        this.restoreCanvasSize();
        this.playCurrentMedia();
      } else if (document.fullscreenElement && !this.isFullscreen) {
        this.isFullscreen = true;
        this.resizeCanvasToFullscreen();
        this.playCurrentMedia();
      }
    });
  
    if (this.mediaItems.length > 0) {
      this.playSequence();
    }
  }
  
  ngOnChanges(changes: SimpleChanges) {
    if (changes['mediaItems']) {
      this.mediaItems = (changes['mediaItems'].currentValue as Media[]).map(item => ({
        ...item,
        texts: item.texts || []
      }));
      this.calculateTotalDuration();
      this.playCurrentMedia();
    }

    if (changes['durationChange'] && this.durationChange) {
      const { media, newDuration } = this.durationChange;
      const localMedia = this.mediaItems.find(m => m.name === media.name);
      if (localMedia) {
        this.pauseSequence();
        localMedia.duration = newDuration;
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
          .reduce((sum, media) => sum + this.getEffectiveDuration(media), 0);
        this.pausedElapsed = 0;
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        const video = this.videoElement.nativeElement;
        video.pause();
        video.currentTime = 0;
        this.playCurrentMedia();
      }
    }
  }

  getEffectiveDuration(media: Media): number {
    return media.duration || (media.type.startsWith('image') ? 5 : 0);
  }

  ngOnDestroy1() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    const video = this.videoElement.nativeElement;
    video.pause();
    video.src = '';
    video.load();
    this.mediaItems.forEach(media => {
      if (media.thumbnail) URL.revokeObjectURL(media.thumbnail);
      if (media.source && media.source.startsWith('blob:')) URL.revokeObjectURL(media.source);
    });
    const canvas = this.canvasElement.nativeElement;
    canvas.removeEventListener('mousemove', this.mouseMoveListener);
    canvas.removeEventListener('click', this.canvasClickListener);
  }
  ngOnDestroy() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    const video = this.videoElement.nativeElement;
    video.pause();
    video.src = '';
    video.load();
    this.mediaItems.forEach(media => {
      if (media.thumbnail) URL.revokeObjectURL(media.thumbnail);
      if (media.source && media.source.startsWith('blob:')) URL.revokeObjectURL(media.source);
    });
    const canvas = this.canvasElement.nativeElement;
    canvas.removeEventListener('mousemove', this.mouseMoveListener);
    canvas.removeEventListener('click', this.canvasClickListener);
    document.removeEventListener('fullscreenchange', () => {}); // Remove fullscreen listener
  }
  private calculateTotalDuration(): void {
    this.totalDuration = this.mediaItems.reduce((sum, media) => {
      return sum + this.getEffectiveDuration(media);
    }, 0);
    this.cdr.detectChanges();
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

    const setDuration = this.getEffectiveDuration(currentMedia);
    const newElapsed = progressPercentage * setDuration;

    this.pausedElapsed = newElapsed;
    this.mediaStartTime = performance.now() - this.pausedElapsed * 1000;

    if (currentMedia.type.startsWith('video')) {
      const video = this.videoElement.nativeElement;
      video.currentTime = newElapsed % (video.duration || setDuration);
    }

    if (this.isPlaying) {
      this.startMediaSequence();
    } else {
      this.playCurrentMedia();
    }
  }

  toggleFullscreen() {
    console.log('Bouton plein écran cliqué');
    const canvas = this.canvasElement.nativeElement;
    if (!document.fullscreenElement) {
      canvas.requestFullscreen().catch(err => console.error('Erreur entrant plein écran :', err));
    } else {
      document.exitFullscreen().catch(err => console.error('Erreur sortant plein écran :', err));
    }
  }
  private resizeCanvasToFullscreen() {
    const canvas = this.canvasElement.nativeElement;
    canvas.width = window.screen.width;
    canvas.height = window.screen.height;
    this.ctx = canvas.getContext('2d')!;
    console.log('Canvas resized to', canvas.width, canvas.height);
    // Test avec un dessin simple
    this.ctx.fillStyle = 'blue';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  private restoreCanvasSize() {
    const canvas = this.canvasElement.nativeElement;
    canvas.width = 800; // Original width
    canvas.height = 450; // Original height
    this.ctx = canvas.getContext('2d')!; // Reinitialize context after resize
  }
  private startMediaSequence() {
    if (this.mediaItems.length > 0 && this.isPlaying) {
      this.playCurrentMedia();
    }
  }

  private playCurrentMedia() {
    console.log('Playing media at size', this.canvasElement.nativeElement.width, 'x', this.canvasElement.nativeElement.height);
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
        currentMedia.texts.forEach(text => {
          if (this.isTextVisible(text)) {
            this.drawOverlayText(text.overlayText ?? '', text.textPosition ?? '');
          }
        });
      };

      video.onloadeddata = () => {
        if (!currentMedia.duration) {
          currentMedia.duration = video.duration;
          this.calculateTotalDuration();
          this.cdr.detectChanges();
        }
        video.currentTime = this.pausedElapsed % (video.duration || this.getEffectiveDuration(currentMedia));
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
        if (elapsed >= this.getEffectiveDuration(currentMedia)) {
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
          currentMedia.texts.forEach(text => {
            if (this.isTextVisible(text)) {
              this.drawOverlayText(text.overlayText ?? '', text.textPosition ?? '');

            }
          });
        };
        const drawImageFrame = (currentTime: number) => {
          this.drawCurrentFrame?.();
          this.drawControls();
          if (this.isPlaying) {
            const elapsed = (currentTime - this.mediaStartTime) / 1000;
            this.updateCumulativeTime(elapsed);
            if (elapsed >= this.getEffectiveDuration(currentMedia)) {
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
      setTimeout(() => this.renderVideoFrame(), 16); // Environ 60 FPS
    }
  }

  private isTextVisible(text: TextOverlay): boolean {
    const elapsed = (performance.now() - this.mediaStartTime) / 1000;
    const startTime = text.startTime || 0;
    const displayDuration = text.displayDuration || this.getEffectiveDuration(this.mediaItems[this.currentMediaIndex]);
    return elapsed >= startTime && elapsed <= (startTime + displayDuration);
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
      .reduce((sum, media) => sum + this.getEffectiveDuration(media), 0);
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

    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = 'rgba(15, 15, 15, 0.8)';
    this.ctx.fillRect(0, controlY, canvas.width, controlHeight);

    this.ctx.fillStyle = '#fff';
    this.ctx.font = '18px Arial';
    this.ctx.fillText(this.isPlaying ? '❚❚' : '▶', 20, controlY + 31);

    const progressBarX = 50;
    const progressBarWidth = canvas.width - 100;
    const progressBarHeight = 4;
    const progressBarY = controlY +5+ (controlHeight - progressBarHeight) / 2;

    const currentMedia = this.mediaItems[this.currentMediaIndex];
    let progressPercentage = 0;

    if (currentMedia) {
      const setDuration = this.getEffectiveDuration(currentMedia);
      const elapsed = this.isPlaying ? (performance.now() - this.mediaStartTime) / 1000 : this.pausedElapsed;
      progressPercentage = setDuration > 0 ? (elapsed / setDuration) * 100 : 0;
      progressPercentage = Math.min(100, Math.max(0, progressPercentage));
    }

    this.ctx.fillStyle = '#555';
    this.ctx.fillRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight);
    this.ctx.fillStyle = '#f00';
    this.ctx.fillRect(progressBarX, progressBarY, (progressPercentage / 100) * progressBarWidth, progressBarHeight);

    this.ctx.fillStyle = '#fff';
    this.ctx.font = '18px Arial';
    this.ctx.fillText('⛶', canvas.width - 32, controlY + 30);

    this.ctx.restore();
  }
  private drawControls1() {
    const canvas = this.canvasElement.nativeElement;
    const controlHeight = 40;
    const controlY = canvas.height - controlHeight;
  
    if (Date.now() - this.lastMouseMove > 3000 && !this.isHoveringControls) {
      this.controlsVisible = false;
    }
  
    if (!this.controlsVisible) return;
  
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = 'rgba(15, 15, 15, 0.8)';
    this.ctx.fillRect(0, controlY, canvas.width, controlHeight);
  
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '18px Arial';
    this.ctx.fillText(this.isPlaying ? '❚❚' : '▶', 20, controlY + 31);
  
    const progressBarX = 50;
    const progressBarWidth = canvas.width - 100;
    const progressBarHeight = 4;
    const progressBarY = controlY + 5 + (controlHeight - progressBarHeight) / 2;
  
    const currentMedia = this.mediaItems[this.currentMediaIndex];
    let progressPercentage = 0;
  
    if (currentMedia) {
      const setDuration = this.getEffectiveDuration(currentMedia);
      const elapsed = this.isPlaying ? (performance.now() - this.mediaStartTime) / 1000 : this.pausedElapsed;
      progressPercentage = setDuration > 0 ? (elapsed / setDuration) * 100 : 0;
      progressPercentage = Math.min(100, Math.max(0, progressPercentage));
    }
  
    this.ctx.fillStyle = '#555';
    this.ctx.fillRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight);
    this.ctx.fillStyle = '#f00';
    this.ctx.fillRect(progressBarX, progressBarY, (progressPercentage / 100) * progressBarWidth, progressBarHeight);
  
    // Update fullscreen icon based on state
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '18px Arial';
    this.ctx.fillText(this.isFullscreen ? '⛽' : '⛶', canvas.width - 32, controlY + 30);
  
    this.ctx.restore();
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
      .reduce((sum, media) => sum + this.getEffectiveDuration(media), 0);
    this.pausedElapsed = 0;

    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

    this.playSequence();

    this.ctx.clearRect(0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);
    this.playCurrentMedia();
  }

  onTextPositionChange() {
    this.playCurrentMedia(); // Redraw the current frame with updated text/position
  }

  addText() {
    
    const currentMedia = this.mediaItems[this.currentMediaIndex];
  
    this.pauseSequence();
    if (!this.validateTextOverlays(currentMedia.texts)) {
      alert("cette position et time reserve");
    } else {
      currentMedia.texts.push({
        overlayText: undefined,
      textPosition: undefined,
      startTime: undefined,
      displayDuration: undefined
      });
      this.onTextChange();
      this.mediaItemsChange.emit([...this.mediaItems]);
    }

  }
  
  
  removeText(index: number) {
    const currentMedia = this.mediaItems[this.currentMediaIndex];
    if (currentMedia && currentMedia.texts[index]) {
      currentMedia.texts.splice(index, 1);
      this.onTextChange();
      this.mediaItemsChange.emit([...this.mediaItems]);
    }
  }
  

  
  private validateTextOverlays(texts: TextOverlay[]): boolean {
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        if (texts[i].textPosition! === texts[j].textPosition!) {
          const start1 = texts[i].startTime!;
          const end1 = texts[i].startTime! + texts[i].displayDuration!;
          const start2 = texts[j].startTime!;
          const end2 = texts[j].startTime! + texts[j].displayDuration!;
          if (start1 < end2 && start2 < end1) {
            return false;
          }
        }
      }
    }
    return true;
  }
  

onTextChange() {
  // Vérifier uniquement le média courant
  const currentMedia = this.mediaItems[this.currentMediaIndex];
  if (!this.validateTextOverlays(currentMedia.texts)) {
    alert("cette position et time reserve");
  } else
   {

  this.cdr.detectChanges();
  this.playCurrentMedia();
  this.mediaItemsChange.emit([...this.mediaItems]); // Émettre la liste mise à jour
}}
 

  getPositionLabel(position: string): string {
    switch (position) {
      case '0': return 'Gauche Haut';
      case '1': return 'Droite Haut';
      case '2': return 'Gauche Bas';
      case '3': return 'Droite Bas';
      case '4': return 'Centre';
      default: return '';
    }
  }

  /** Retourne les textes associés à une position donnée avec leurs startGlobal et endGlobal */
/** Retourne les textes associés à une position donnée avec leurs startGlobal et endGlobal.
 *  Si plusieurs textes sont présents pour la même position et le même temps, 
 *  on retourne une entrée unique avec le message d'erreur.
 */
getTextsForPosition(position: string): any[] {
  const texts = [];
  // Parcourir tous les médias
  for (const media of this.mediaItems) {
    const mediaStartGlobal = this.getMediaStartGlobal(media);
    for (const text of media.texts) {
      // On considère uniquement les textes pour la position demandée et dont overlayText est défini
      if (text.textPosition === position && text.overlayText) {
        const textStartGlobal = mediaStartGlobal + (text.startTime || 0);
        const textEndGlobal = textStartGlobal + (text.displayDuration || 0);
        texts.push({
          text: text.overlayText,
          startGlobal: textStartGlobal,
          endGlobal: textEndGlobal,
          textPosition: text.textPosition,
          startTime: text.startTime
        });
      }
    }
  }

  // Trier les textes par leur temps de début
  texts.sort((a, b) => a.startGlobal - b.startGlobal);

  const finalTexts: any[] = [];
  let group: any[] = [];

  // Regrouper les textes dont les périodes se chevauchent
  for (const t of texts) {
    if (group.length === 0) {
      group.push(t);
    } else {
      // Calculer la fin maximale du groupe courant
      const groupEnd = Math.max(...group.map(item => item.endGlobal));
      // Si le texte courant commence avant la fin du groupe, il se chevauche
      if (t.startGlobal < groupEnd) {
        group.push(t);
      } else {
        // Le texte ne chevauche pas le groupe courant, on traite le groupe
        if (group.length > 1) {
          finalTexts.push({
            text: "cette position et time reserve",
            startGlobal: group[0].startGlobal,
            endGlobal: groupEnd
          });
        } else {
          finalTexts.push(group[0]);
        }
        // On démarre un nouveau groupe
        group = [t];
      }
    }
  }
  // Traiter le dernier groupe
  if (group.length > 0) {
    const groupEnd = Math.max(...group.map(item => item.endGlobal));
    if (group.length > 1) {
      finalTexts.push({
        text: "cette position et time reserve",
        startGlobal: group[0].startGlobal,
        endGlobal: groupEnd
      });
    } else {
      finalTexts.push(group[0]);
    }
  }

  return finalTexts;
}



  /** Calcule le startGlobal d'un média en fonction de sa position dans la séquence */
  private getMediaStartGlobal(media: Media): number {
    const index = this.mediaItems.indexOf(media);
    return this.mediaItems
      .slice(0, index)
      .reduce((sum, m) => sum + this.getEffectiveDuration(m), 0);
  }


}