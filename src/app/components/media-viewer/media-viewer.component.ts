import { Component, Input, AfterViewInit, ViewChild, ElementRef, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { Media } from '../../models/Media';

@Component({
  selector: 'app-media-viewer',
  templateUrl: './media-viewer.component.html',
  styleUrls: ['./media-viewer.component.css']
})
export class MediaViewerComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() mediaItems: Media[] = []; // Liste des éléments média (images/vidéos)
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>; // Référence au canvas pour le rendu
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>; // Référence à l'élément vidéo

  @Input() selectedMedia?: Media; // Média sélectionné (optionnel)

  currentMediaIndex = 0; // Index du média actuel dans mediaItems
  totalDuration = 0; // Durée totale de la séquence média
  cumulativeTime = 0; // Temps écoulé cumulé dans la séquence
  private ctx!: CanvasRenderingContext2D; // Contexte 2D du canvas pour dessiner
  private animationFrameId: number | null = null; // ID de l'animation pour la boucle de rendu
  private isPlaying = false; // État de lecture (en cours ou en pause)
  private isHoveringControls = false; // Indique si la souris est sur les contrôles
  private controlsVisible = true; // Visibilité des contrôles (play/pause, barre de progression)
  private lastMouseMove = 0; // Dernier mouvement de souris (pour masquer les contrôles)

  private pausedAtTime: number | null = null; // Temps où une vidéo a été mise en pause
  private imageStartTime: number = 0; // Temps de départ pour une image
  private imagePausedElapsed: number = 0; // Temps écoulé pour une image en pause

  // Listeners pour les événements de la souris
  private mouseMoveListener = (event: MouseEvent) => this.handleMouseMove(event);
  private canvasClickListener = (event: MouseEvent) => this.handleCanvasClick(event);

  // Initialisation après le rendu de la vue
  ngAfterViewInit() {
    this.setupCanvas(); // Configure le canvas
    this.calculateTotalDuration(); // Calcule la durée totale
    const canvas = this.canvasElement.nativeElement;
    canvas.addEventListener('mousemove', this.mouseMoveListener); // Ajoute l'écouteur pour le mouvement
    canvas.addEventListener('click', this.canvasClickListener); // Ajoute l'écouteur pour les clics
  }

  // Gestion des changements dans les inputs
  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedMedia'] && this.selectedMedia) {
      const index = this.mediaItems.findIndex(item => item.name === this.selectedMedia!.name);
      if (index !== -1) {
        this.selectMedia(index); // Sélectionne le média spécifié
      }
    }
    if (changes['mediaItems']) {
      this.calculateTotalDuration(); // Recalcule la durée si la liste change
      this.playCurrentMedia(); // Lance le média actuel
    }
  }

  // Nettoyage lors de la destruction du composant
  ngOnDestroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId); // Annule l'animation en cours
    }
    this.mediaItems.forEach(media => {
      if (media.thumbnail) URL.revokeObjectURL(media.thumbnail); // Libère les URLs des thumbnails
      if (media.source) URL.revokeObjectURL(media.source); // Libère les URLs des sources
    });
    const canvas = this.canvasElement.nativeElement;
    canvas.removeEventListener('mousemove', this.mouseMoveListener); // Supprime les écouteurs
    canvas.removeEventListener('click', this.canvasClickListener);
  }

  // Calcule la durée totale des médias
  private calculateTotalDuration() {
    this.totalDuration = this.mediaItems.reduce((sum, media) => {
      return sum + (media.duration || (media.type.startsWith('image') ? 5 : 0)); // 5s par défaut pour les images
    }, 0);
  }

  // Configure les dimensions et le contexte du canvas
  private setupCanvas() {
    const canvas = this.canvasElement.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    canvas.width = 800; // Largeur fixe
    canvas.height = 450; // Hauteur fixe
  }

  // Gère le mouvement de la souris pour afficher les contrôles
  private handleMouseMove(event: MouseEvent) {
    this.lastMouseMove = Date.now();
    this.controlsVisible = true;
    const canvas = this.canvasElement.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const y = event.clientY - rect.top;
    this.isHoveringControls = y > (canvas.height - 40); // Vérifie si la souris est sur les contrôles
  }

  // Gère les clics sur le canvas (play/pause, seek, fullscreen)
  private handleCanvasClick(event: MouseEvent) {
    const canvas = this.canvasElement.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (y > canvas.height - 40) { // Zone des contrôles
      const progressBarStart = 50;
      const progressBarWidth = canvas.width - 100;

      if (x >= 10 && x <= 40) {
        this.togglePlayPause(); // Bouton play/pause
      } else if (x >= progressBarStart && x <= progressBarStart + progressBarWidth) {
        const progressPercentage = (x - progressBarStart) / progressBarWidth;
        this.seekTo(progressPercentage); // Cherche dans la barre de progression
      } else if (x >= canvas.width - 40) {
        this.toggleFullscreen(); // Bouton plein écran
      }
    }
  }

  // Alterne entre lecture et pause
  togglePlayPause() {
    if (this.isPlaying) {
      this.pauseSequence();
    } else {
      this.playSequence();
    }
  }

  // Lance la séquence si elle n'est pas déjà en cours
  private playSequence() {
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.startMediaSequence();
    }
  }

  // Met la séquence en pause
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
          this.pausedAtTime = video.currentTime; // Sauvegarde le temps de pause
        } else if (currentMedia.type.startsWith('image')) {
          this.imagePausedElapsed = performance.now() - this.imageStartTime; // Temps écoulé pour l'image
        }
      }
      this.drawControls(); // Met à jour les contrôles
    }
  }

  // Déplace la lecture à un pourcentage donné
  seekTo(progressPercentage: number) {
    const currentMedia = this.mediaItems[this.currentMediaIndex];
    if (!currentMedia) return;

    const mediaDuration = currentMedia.duration || (currentMedia.type.startsWith('image') ? 5 : 0);
    const newTime = progressPercentage * mediaDuration;

    if (currentMedia.type.startsWith('video')) {
      const video = this.videoElement.nativeElement;
      video.currentTime = newTime;
      this.pausedAtTime = newTime;
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

  // Passe en mode plein écran ou en sort
  toggleFullscreen() {
    const canvas = this.canvasElement.nativeElement;
    if (!document.fullscreenElement) {
      canvas.requestFullscreen().catch(err => console.error('Erreur plein écran :', err));
    } else {
      document.exitFullscreen();
    }
  }

  // Démarre la séquence média si elle est en lecture
  private startMediaSequence() {
    if (this.mediaItems.length > 0 && this.isPlaying) {
      this.playCurrentMedia();
    }
  }

  // Joue le média actuel (vidéo ou image)
  private playCurrentMedia() {
    const currentMedia = this.mediaItems[this.currentMediaIndex];
    if (!currentMedia) return;

    this.ctx.clearRect(0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);

    if (currentMedia.type.startsWith('video')) {
      const video = this.videoElement.nativeElement;
      video.src = '';
      video.src = currentMedia.source || currentMedia.thumbnail || `assets/${currentMedia.name}`;
      video.muted = false;

      video.onloadeddata = () => {
        if (!currentMedia.duration) {
          currentMedia.duration = video.duration; // Met à jour la durée si absente
          this.calculateTotalDuration();
        }
        video.currentTime = this.pausedAtTime || 0;
        if (this.isPlaying) {
          video.play().catch(err => console.error('Erreur de lecture vidéo :', err));
        }
        this.renderVideoFrame();
      };

      video.onerror = () => {
        console.error(`Erreur de chargement de la vidéo : ${currentMedia.name}`);
        this.nextMedia(); // Passe au suivant en cas d'erreur
      };

      video.ontimeupdate = () => {
        const elapsed = video.currentTime;
        this.updateCumulativeTime(elapsed);
        if (elapsed >= (currentMedia.duration || video.duration)) {
          video.pause();
          this.nextMedia(); // Fin de la vidéo, passe au suivant
        }
      };
    } else if (currentMedia.type.startsWith('image')) {
      const img = new Image();
      img.src = currentMedia.thumbnail || 'assets/default-image.jpg';
      img.onload = () => {
        this.imageStartTime = performance.now() - (this.imagePausedElapsed || 0);
        const drawImageFrame = (currentTime: number) => {
          if (!this.isPlaying) {
            this.ctx.drawImage(img, 0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);
            this.drawControls();
            return;
          }
          const elapsed = (currentTime - this.imageStartTime) / 1000;
          this.updateCumulativeTime(elapsed);
          if (elapsed >= (currentMedia.duration || 5)) {
            this.nextMedia(); // Fin de la durée de l'image
          } else {
            this.ctx.drawImage(img, 0, 0, this.canvasElement.nativeElement.width, this.canvasElement.nativeElement.height);
            this.drawControls();
            this.animationFrameId = requestAnimationFrame(drawImageFrame); // Boucle de rendu
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

  // Rend une frame vidéo sur le canvas
  private renderVideoFrame() {
    const canvas = this.canvasElement.nativeElement;
    const video = this.videoElement.nativeElement;
    this.ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    this.drawControls();
    if (this.isPlaying && !video.paused && !video.ended) {
      this.animationFrameId = requestAnimationFrame(() => this.renderVideoFrame());
    }
  }

  // Met à jour le temps cumulé
  private updateCumulativeTime(elapsed: number) {
    const previousMediaDuration = this.mediaItems
      .slice(0, this.currentMediaIndex)
      .reduce((sum, media) => sum + (media.duration || 0), 0);
    this.cumulativeTime = Math.max(0, previousMediaDuration + elapsed);
    this.cumulativeTime = Math.min(this.cumulativeTime, this.totalDuration);
  }

  // Dessine les contrôles (play/pause, barre de progression, plein écran)
  private drawControls() {
    const canvas = this.canvasElement.nativeElement;
    const controlHeight = 40;
    const controlY = canvas.height - controlHeight;

    if (Date.now() - this.lastMouseMove > 3000 && !this.isHoveringControls) {
      this.controlsVisible = false; // Masque les contrôles après 3s d'inactivité
    }

    if (!this.controlsVisible) return;

    this.ctx.fillStyle = 'rgba(15, 15, 15, 0.8)';
    this.ctx.fillRect(0, controlY, canvas.width, controlHeight);

    this.ctx.fillStyle = '#fff';
    this.ctx.font = '18px Arial';
    this.ctx.fillText(this.isPlaying ? '❚❚' : '▶', 20, controlY + 25); // Play ou Pause

    const progressBarWidth = canvas.width - 100;
    const progressBarX = 50;

    const currentMedia = this.mediaItems[this.currentMediaIndex];
    let progressPercentage = 0;

    if (currentMedia) {
      const mediaDuration = currentMedia.duration || (currentMedia.type.startsWith('image') ? 5 : 0);
      let elapsedTime = 0;

      if (currentMedia.type.startsWith('video')) {
        elapsedTime = this.videoElement.nativeElement.currentTime;
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
    this.ctx.fillRect(progressBarX, controlY + 15, progressBarWidth, 4); // Barre de progression grise
    this.ctx.fillStyle = '#f00';
    this.ctx.fillRect(progressBarX, controlY + 15, (progressPercentage / 100) * progressBarWidth, 4); // Progression rouge

    this.ctx.fillStyle = '#fff';
    this.ctx.font = '18px Arial';
    this.ctx.fillText('⛶', canvas.width - 30, controlY + 25); // Icône plein écran
  }

  // Passe au média suivant
  private nextMedia() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.pausedAtTime = null;
    this.imagePausedElapsed = 0;
    this.imageStartTime = 0;

    const video = this.videoElement.nativeElement;
    video.pause();
    video.currentTime = 0;

    if (this.mediaItems.length > 0) {
      this.currentMediaIndex = (this.currentMediaIndex + 1) % this.mediaItems.length; // Boucle au début si fin atteinte
      if (this.currentMediaIndex === 0) {
        this.cumulativeTime = 0; // Réinitialise le temps cumulé
      }
      this.playCurrentMedia(); // Joue le suivant (même si en pause, pour affichage)
    }
  }

  // Sélectionne un média spécifique par index
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
    this.playCurrentMedia(); // Affiche le média sélectionné
  }
}