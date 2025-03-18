import { Injectable } from '@angular/core';
import { Media } from '../models/Media';

@Injectable({
  providedIn: 'root'
})
export class MediaSidebarService {
  constructor() {}



  async processFile(file: File): Promise<Media> {
    // Liste étendue des extensions vidéo reconnues
    const videoExtensions = /\.(mp4|avi|mov|wmv|webm|ogg|mkv|flv|3gp|mpeg|mpg|ts|vob)$/i;
    const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|tiff|tif|svg)$/i;

    // Vérification plus robuste du type de fichier
    const isVideo = file.type.startsWith('video/') || videoExtensions.test(file.name);
    const isImage = file.type.startsWith('image/') || imageExtensions.test(file.name);

    if (isVideo) {
      return this.processVideo(file);
    } else if (isImage) {
      return this.processImage(file);
    }
    throw new Error('Unsupported media type');
  }

  private async processVideo(file: File): Promise<Media> {
    return new Promise((resolve, reject) => {
      const newMedia: Media = {
        name: file.name,
        type: file.type || 'video/mp4', // Valeur par défaut si type non détecté
        source: URL.createObjectURL(file),
        thumbnail: ''
      };

      const video = document.createElement('video');
      video.preload = 'metadata';
      // Ajout des codecs supportés
      video.setAttribute('type', 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
      video.src = newMedia.source || '';

      video.onloadedmetadata = () => {
        newMedia.originalDuration = video.duration;
        newMedia.duration = video.duration;
        newMedia.startTime = 0;
        newMedia.endTime = newMedia.duration;

        // Essayer de générer une miniature à différents points si le premier échoue
        const attemptThumbnail = (time: number) => {
          video.currentTime = time;
        };

        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            newMedia.thumbnail = canvas.toDataURL('image/jpeg', 0.8);
            resolve(newMedia);
          }
        };

        video.onerror = () => {
          // Si le premier essai échoue, essayer à t=0
          if (video.currentTime !== 0) {
            attemptThumbnail(0);
          } else {
            reject(new Error('Erreur de chargement de la vidéo'));
          }
        };

        attemptThumbnail(1); // Premier essai à 1 seconde
      };
    });
  }
  private processImage(file: File): Promise<Media> {
    return new Promise((resolve, reject) => {
      const newMedia: Media = {
        name: file.name,
        type: file.type || 'image/jpeg', // Valeur par défaut
        thumbnail: '',
        duration: 5,
        startTime: 0,
        endTime: 5
      };

      const img = new Image();
      img.src = URL.createObjectURL(file);
      
      img.onload = () => {
        newMedia.thumbnail = img.src;
        resolve(newMedia);
      };

      img.onerror = () => {
        reject(new Error('Erreur de chargement de l\'image'));
      };
    });
  }
  updateMediaTimes(mediaItems: Media[]): Media[] {
    let currentTime = 0;
    for (const media of mediaItems) {
      media.startTime = currentTime;
      media.endTime = currentTime + (media.duration || 0);
      currentTime = media.endTime;
    }
    return mediaItems;
  }

  reorderMediaItems(mediaItems: Media[], previousIndex: number, currentIndex: number): Media[] {
    const reorderedItems = [...mediaItems];
    const [movedItem] = reorderedItems.splice(previousIndex, 1);
    reorderedItems.splice(currentIndex, 0, movedItem);
    return this.updateMediaTimes(reorderedItems);
  }
}


