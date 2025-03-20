import { Component, Input } from '@angular/core';
import { Media as GlobalMedia } from '../models/Media'; // Importez l'interface globale

interface TextOverlay {
  overlayText: string;
  textPosition: string;
  startTime: number;
  displayDuration: number;
}

interface Media {
  name: string;
  type: string;
  duration?: number;
  startTime?: number;
  displayDuration?: number;
  thumbnail?: string;
  originalDuration?: number;
  source?: string;
  overlayText?: string;
  textPosition?: string;
  texts: TextOverlay[];
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  selectedMedia: Media | null = null;
  @Input() mediaItems: Media[] = [];

  onMediaSelected(media: GlobalMedia) {
    const adaptedMedia: Media = {
      ...media,
      texts: (media as any).texts || [] // Ajoutez une liste vide si texts n'existe pas
    };
    this.selectedMedia = adaptedMedia;
  }

  onMediaItemsChange(mediaItems: GlobalMedia[]) {
    this.mediaItems = mediaItems.map(item => ({
      ...item,
      texts: (item as any).texts || [] // Ajoutez une liste vide par défaut
    }));
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const data = event.dataTransfer?.getData('text/plain');
    if (data) {
      const globalMedia: GlobalMedia = JSON.parse(data);
      const adaptedMedia: Media = {
        ...globalMedia,
        texts: (globalMedia as any).texts || []
      };
      this.selectedMedia = adaptedMedia;
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  getMainContentClass() {
    return this.mediaItems.length > 0 ? 'main-content with-viewer' : 'main-content';
  }
}