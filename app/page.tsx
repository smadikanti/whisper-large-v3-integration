
'use client';

import React, { useState, useRef } from 'react';
import { Mic, Square, FileAudio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const addLog = (message: string) => {
    setLogs(prevLogs => [...prevLogs, `${new Date().toISOString()}: ${message}`]);
    console.log(message);
  };

  const startRecording = async () => {
    try {
      addLog('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      addLog('Microphone access granted.');
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          addLog(`Received audio chunk of size: ${event.data.size} bytes`);
        }
      };

      mediaRecorder.start();
      addLog('Started recording.');
      setIsRecording(true);
    } catch (error) {
      addLog(`Error starting recording: ${error}`);
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      addLog('Stopped recording.');
      setIsRecording(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const generateTranscript = async () => {
    addLog('Preparing audio data for transcription...');
    
    // Temporarily stop recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      addLog('Temporarily stopped recording for transcription.');
    }

    // Wait for the last chunk to be processed
    await new Promise(resolve => setTimeout(resolve, 100));

    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    addLog(`Audio blob created. Size: ${audioBlob.size} bytes`);
    
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-large-v3');

    try {
      addLog('Sending request to Groq API...');
      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_GROQ_API_KEY}`,
        },
        body: formData,
      });

      addLog(`Received response. Status: ${response.status}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      addLog('Successfully parsed response JSON.');
      setTranscription(prevTranscription => prevTranscription + ' ' + data.text);
      addLog(`Transcription appended: ${data.text.substring(0, 50)}...`);
    } catch (error) {
      addLog(`Error transcribing audio: ${error}`);
      console.error('Error transcribing audio:', error);
      setTranscription(prevTranscription => prevTranscription + ' Error transcribing audio. Please try again.');
    }

    // Resume recording
    if (streamRef.current) {
      const newMediaRecorder = new MediaRecorder(streamRef.current);
      mediaRecorderRef.current = newMediaRecorder;
      audioChunksRef.current = [];

      newMediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          addLog(`Received audio chunk of size: ${event.data.size} bytes`);
        }
      };

      newMediaRecorder.start();
      addLog('Resumed recording.');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4 sm:p-6 md:p-8 lg:p-24 space-y-6">
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">Whisper Large V3 Live Integration</h1>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <Button
              onClick={startRecording}
              disabled={isRecording}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Mic className="mr-2 h-4 w-4" />
              Start Recording
            </Button>
            <Button
              onClick={stopRecording}
              disabled={!isRecording}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              <Square className="mr-2 h-4 w-4" />
              Stop Recording
            </Button>
            <Button
              onClick={generateTranscript}
              disabled={!isRecording}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              <FileAudio className="mr-2 h-4 w-4" />
              Generate Transcript
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Transcription</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px] w-full rounded-md border p-4">
            <p className="whitespace-pre-wrap">
              {transcription || 'Generate transcript to see result here.'}
            </p>
          </ScrollArea>
        </CardContent>
      </Card>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px] w-full rounded-md border">
            <pre className="p-4 text-sm">
              {logs.join('\n')}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </main>
  );
}