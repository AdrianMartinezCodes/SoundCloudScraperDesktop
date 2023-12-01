import { Mp3Metadata } from '../interfaces/electron/electronHandlerInputs';
import { ErrorResponse } from '../interfaces/express/Error';
import { SongTitle } from '../interfaces/express/ResponseBody';

const fs = require('fs')
const sharp = require('sharp');
import * as mm from "music-metadata"
const nid3 = require('node-id3')
const { Readable } = require('stream');
const { finished } = require('stream/promises');

export const workingDir = process.env.USERPROFILE + '\\SoundCloudScraper'

export const initDirs = () => {
    const songDir = `${workingDir}/songs`
    if (!fs.existsSync()) {
        fs.mkdirSync(songDir,{ recursive: true })
    }

    const imagesDir = `${workingDir}/images`
    if (!fs.existsSync()) {
        fs.mkdirSync(imagesDir,{ recursive: true })
    }
}

export const getImgPathFromURL = (songName: string, imgURL: string) => {
    const urlSplit = imgURL.split(".")
    const imageType = urlSplit[urlSplit.length - 1]
    const imagePath = `${workingDir}/images/${songName}.${imageType}`
    return imagePath
}

async function convertToPng(inputPath: string) {
    try {
        const outputPath = inputPath.split('.')[0] + '.png'
        await sharp(inputPath).toFormat('png').toFile(outputPath);
        console.log('Image converted successfully to PNG:', outputPath);
    } catch (error) {
        console.error('Error converting image to PNG:', error)
        throw error
    }
  }

export const downloadThumbnail = async(songName: string, imgURL: string) => {
    const imagePath = getImgPathFromURL(songName,imgURL)    
    const stream = fs.createWriteStream(imagePath)
    const response = await fetch(imgURL)
    await finished(Readable.fromWeb(response.body).pipe(stream))
    if(imagePath.indexOf('.png') === -1) {
        await convertToPng(imagePath)
        fs.unlinkSync(imagePath)
    }
}

export const editMp3CoverArt = async (songName: string, imagePath: string) => {
    const songPath = `${workingDir}/songs/${songName}.mp3`
    const tags = nid3.read(songPath)
    tags.image = {
        mime: 'image/png',
        type: {
            id: 3, // Cover (front) image
            name: 'front'
        },
        description: 'Cover',
        imageBuffer: fs.readFileSync(imagePath)
    }
    nid3.write(tags, songPath)
}

const copyLocalImageToImages = (path: string) => {
    const fileNameArr: string[] = path.split('/')
    const fileName: string = fileNameArr[fileNameArr.length - 1]
    const copyPath = `${workingDir}/images/${fileName}`

    fs.readFile(path, (err: NodeJS.ErrnoException | null, data: Buffer) => {
        if (err) {
          console.error('Error reading the source image:', err);
          return;
        }
      
        fs.writeFile(copyPath, data, (err: NodeJS.ErrnoException | null) => {
          if (err) {
            console.error('Error writing the destination image:', err);
            return;
          }
        });
    });
}

export const editMp3Metadata = async(metadata: Mp3Metadata) => {
    const path = `${workingDir}/songs/${metadata.title}.mp3`
    const mp3Metadata: mm.IAudioMetadata = await mm.parseFile(path);
    
    if(!mp3Metadata.common.title) {
        const data = await fetchData<SongTitle[]>(`http://localhost:11738/songs`,{
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title: metadata.title }),
        })
    } else {
        const data = await fetchData<SongTitle[]>(`http://localhost:11738/songs/${mp3Metadata.common.title}`,{
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ newTitle: metadata.title }),
        })
    }
    mp3Metadata.common.title = metadata.title

    if(metadata.artist != null) {
        mp3Metadata.common.artist = metadata.artist;
    }

    if(metadata.imgPath != null) {
        editMp3CoverArt(metadata.title, metadata.imgPath)
    }

    nid3.update(mp3Metadata.common, path)
    await mm.parseFile(path)
}

export const fetchData = async <T extends object>(url: string, options: RequestInit = {}) => {
    const response = await fetch(url,options)
    const data: T | ErrorResponse = await response.json()
    if('error' in data) {
        throw new Error(data.error)
    }
    return data as T
}