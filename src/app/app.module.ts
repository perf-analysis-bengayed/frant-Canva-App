import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HomeComponent } from './home/home.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { MediaInfoComponent } from './components/media-info/media-info.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MediaViewerComponent } from './components/media-viewer/media-viewer.component';





@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    SidebarComponent,
    MediaInfoComponent,
    MediaViewerComponent
    
    
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule,
    DragDropModule

  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
