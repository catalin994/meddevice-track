import React from 'react';
import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { TaskPriority, TaskStatus } from '../types';

/**
 * Cum arata prioritatea si starea unui tichet.
 *
 * Stateau in lista de tichete, unde s-au nascut. De cand tichetul se deschide
 * si pe o fisa a lui, aceleasi culori trebuie sa iasa in amandoua locurile —
 * un tichet critic scris cu rosu in lista si cu albastru pe fisa ar parea alt
 * tichet.
 */

export const getPriorityColor = (p: TaskPriority) => {
  switch(p) {
    case TaskPriority.CRITICAL: return 'bg-red-600';
    case TaskPriority.HIGH: return 'bg-orange-500';
    case TaskPriority.MEDIUM: return 'bg-blue-500';
    case TaskPriority.LOW: return 'bg-slate-400';
  }
};

export const getPriorityText = (p: TaskPriority) => {
  switch(p) {
    case TaskPriority.CRITICAL: return 'bg-red-50 text-red-700 border border-red-100';
    case TaskPriority.HIGH: return 'bg-orange-50 text-orange-700 border border-orange-100';
    case TaskPriority.MEDIUM: return 'bg-blue-50 text-blue-600 border border-blue-100';
    case TaskPriority.LOW: return 'bg-slate-50 text-slate-600 border border-slate-100';
  }
};

export const getStatusStyles = (s: TaskStatus) => {
  switch(s) {
    case TaskStatus.PENDING: return 'border-slate-200 text-slate-500 bg-white hover:border-slate-300';
    case TaskStatus.IN_PROGRESS: return 'border-blue-200 text-blue-600 bg-blue-50/50 hover:bg-blue-50';
    case TaskStatus.COMPLETED: return 'border-green-200 text-green-600 bg-green-50/50 hover:bg-green-50';
  }
};

export const getStatusIcon = (s: TaskStatus) => {
  switch(s) {
    case TaskStatus.PENDING: return <Clock className="w-3.5 h-3.5" />;
    case TaskStatus.IN_PROGRESS: return <AlertCircle className="w-3.5 h-3.5 animate-pulse" />;
    case TaskStatus.COMPLETED: return <CheckCircle2 className="w-3.5 h-3.5" />;
  }
};
