import { Component, Input } from '@angular/core';

interface Media {
  name: string;
  type: string;
  duration?: number;
  startTime?: number;
  endTime?: number;
  thumbnail?: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  selectedMedia: Media | null = null;
  @Input() mediaItems: Media[] = [];

  onMediaSelected(media: Media) {
    this.selectedMedia = media;
  }

  onMediaItemsChange(mediaItems: Media[]) {
    this.mediaItems = mediaItems;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const data = event.dataTransfer?.getData('text/plain');
    if (data) {
      const media: Media = JSON.parse(data);
      this.selectedMedia = media;
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  getMainContentClass() {
    return this.mediaItems.length > 0 ? 'main-content with-viewer' : 'main-content';
  }
}