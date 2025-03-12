// home.component.ts
import { Component } from '@angular/core';

interface Media {
  name: string;
  type: string;
  duration?: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  selectedMedia: Media | null = null;

  onMediaSelected(media: Media) {
    this.selectedMedia = media;
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
    return this.selectedMedia ? 'main-content with-viewer' : 'main-content';
  }
}