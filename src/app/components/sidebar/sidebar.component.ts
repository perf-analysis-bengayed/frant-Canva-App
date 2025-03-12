// sidebar.component.ts
import { Component, Output, EventEmitter } from '@angular/core';

interface Media {
  name: string;
  type: string;
  duration?: string;
  thumbnail?: string;
}

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  @Output() mediaSelected = new EventEmitter<Media>();

  mediaItems: Media[] = [
  ];

  selectedMedia: Media | null = null;

  selectMedia(media: Media) {
    this.selectedMedia = media;
    this.mediaSelected.emit(media);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const newMedia: Media = {
        name: file.name,
        type: file.type,
        thumbnail: URL.createObjectURL(file) // URL temporaire pour les images
      };

      if (file.type.startsWith('video')) {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = URL.createObjectURL(file);

        video.onloadedmetadata = () => {
          newMedia.duration = this.formatDuration(video.duration);
          // Générer le thumbnail
          video.currentTime = 1; // 1ère seconde
          video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              newMedia.thumbnail = canvas.toDataURL('image/jpeg');
            }
            this.mediaItems.push(newMedia);
            URL.revokeObjectURL(video.src);
          };
        };
      } else {
        this.mediaItems.push(newMedia);
      }
    }
  }

  private formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  }
}