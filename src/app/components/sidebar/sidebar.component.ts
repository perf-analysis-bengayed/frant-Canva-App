import { Component, Output, EventEmitter } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

interface Media {
  name: string;
  type: string;
  duration?: number;
  startTime?: number;
  endTime?: number;
  thumbnail?: string;
  originalDuration?: number;
  source?: string; // Ajouter une propriété pour la source réelle
}


@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  @Output() mediaSelected = new EventEmitter<Media>();
  @Output() mediaItemsChange = new EventEmitter<Media[]>();

  mediaItems: Media[] = [];
  selectedMedia: Media | null = null;


  selectMedia(media: Media) {
    this.selectedMedia = media;
    this.mediaSelected.emit(media);
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
  
      if (file.type.startsWith('video')) {
        const newMedia: Media = {
          name: file.name,
          type: file.type,
          // Conserver l’URL de la vidéo pour la lecture
          source: URL.createObjectURL(file),
          // On initialise thumbnail avec l’URL du fichier, qui sera remplacée après traitement
          thumbnail: URL.createObjectURL(file)
        };
  
        const video = document.createElement('video');
        video.preload = 'metadata';
        // Utiliser la source réelle pour charger la vidéo
        video.src = newMedia.source ?? "";
  
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            newMedia.originalDuration = video.duration;
            newMedia.duration = video.duration;
            newMedia.startTime = 0;
            newMedia.endTime = newMedia.duration;
  
            video.currentTime = 1;
            video.onseeked = () => {
              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                // Génère un thumbnail à partir de la vidéo
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                newMedia.thumbnail = canvas.toDataURL('image/jpeg');
              }
              this.addMedia(newMedia);
              URL.revokeObjectURL(video.src);
              resolve();
            };
          };
        });
      } else if (file.type.startsWith('image')) {
        const newMedia: Media = {
          name: file.name,
          type: file.type,
          thumbnail: URL.createObjectURL(file),
          duration: 5,
          startTime: 0,
          endTime: 5
        };
        this.addMedia(newMedia);
      }
    }
  }
  

  addMedia(media: Media) {
    this.mediaItems.push(media);
    this.updateMediaTimes();
    this.mediaItemsChange.emit(this.mediaItems);
  }

  updateMediaTimes() {
    let currentTime = 0;
    for (const media of this.mediaItems) {
      media.startTime = currentTime;
      media.endTime = currentTime + (media.duration || 0);
      currentTime = media.endTime;
    }
  }

  onDrop(event: CdkDragDrop<Media[]>) {
    moveItemInArray(this.mediaItems, event.previousIndex, event.currentIndex);
    this.updateMediaTimes();
    this.mediaItemsChange.emit(this.mediaItems);
  }

  onDurationChange() {
    this.updateMediaTimes();
    this.mediaItemsChange.emit(this.mediaItems);
  }

  onTimeChange() {
    this.updateMediaTimes();
    this.mediaItemsChange.emit(this.mediaItems);
  }


}